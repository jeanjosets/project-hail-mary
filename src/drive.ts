import { getJournalFolderParts, MONTHS, pad, cleanEntryText, stripHtml, fmtLong } from './utils';

// Google API client credentials
export const CLIENT_ID = '651548279771-86rvs7k45o763e67vd54gsij4q5e17eq.apps.googleusercontent.com';
export const SCOPE = 'https://www.googleapis.com/auth/drive';

// Shared internal state
let _token: string | null = null;
let _tokenExpiry = 0;
let _tokenClient: any = null;
let _tokenRefreshing = false;
const _tokenResolvers: Array<(token: string | null) => void> = [];
let _rootId: string | null = null;
let _driveReady = false;
let _isManualConnect = false;

// Callbacks for notifying UI changes
let onStatusChange: ((state: 'live' | 'connecting' | 'error', detail?: string) => void) | null = null;
let onDataLoaded: (() => void) | null = null;

export function registerDriveCallbacks(
  statusCb: (state: 'live' | 'connecting' | 'error', detail?: string) => void,
  loadedCb: () => void
) {
  onStatusChange = statusCb;
  onDataLoaded = loadedCb;
}

export function getDriveState() {
  return {
    ready: _driveReady,
    rootId: _rootId,
    token: _token
  };
}

/* ==========================================
   IndexedDB Local Cache for Audio Blobs
   ========================================== */
let _idb: IDBDatabase | null = null;

export function openIDB(): Promise<IDBDatabase> {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('phm-audio', 1);
    req.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('blobs');
    };
    req.onsuccess = (e: any) => {
      _idb = e.target.result;
      res(_idb!);
    };
    req.onerror = () => {
      rej(req.error);
    };
  });
}

export function saveLocalAudio(trackId: string, blob: Blob): Promise<void> {
  return openIDB().then((db) => {
    return new Promise<void>((res) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(blob, 'phm-local-audio-' + trackId);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }).catch(() => {});
}

export function loadLocalAudio(trackId: string): Promise<Blob | null> {
  return openIDB().then((db) => {
    return new Promise<Blob | null>((res) => {
      const req = db.transaction('blobs').objectStore('blobs').get('phm-local-audio-' + trackId);
      req.onsuccess = () => {
        res(req.result || null);
      };
      req.onerror = () => {
        res(null);
      };
    });
  }).catch(() => null);
}

export function removeLocalAudio(trackId: string): Promise<void> {
  return openIDB().then((db) => {
    return new Promise<void>((res) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete('phm-local-audio-' + trackId);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }).catch(() => {});
}

/* ==========================================
   Google Drive (GIS) Setup & Auth
   ========================================== */
export function setupGIS(onLoaded?: () => void) {
  const g = (window as any).google;
  if (!g || !g.accounts) {
    // Retry polling if the script hasn't fully loaded yet
    setTimeout(() => setupGIS(onLoaded), 500);
    return;
  }
  try {
    _tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: any) => {
        if (resp && resp.access_token) {
          _token = resp.access_token;
          _tokenExpiry = Date.now() + (resp.expires_in || 3599) * 1000;
          _tokenRefreshing = false;
          const resolvers = _tokenResolvers.splice(0);
          resolvers.forEach((r) => r(_token));
          _afterSignIn();
        } else {
          _tokenRefreshing = false;
          const resolvers = _tokenResolvers.splice(0);
          resolvers.forEach((r) => r(null));
          driveErr('Token response had no access_token: ' + (resp && resp.error || 'unknown'));
        }
      },
      error_callback: (e: any) => {
        _tokenRefreshing = false;
        const resolvers = _tokenResolvers.splice(0);
        resolvers.forEach((r) => r(null));
        driveErr('GIS error: ' + JSON.stringify(e));
      }
    });
    if (onLoaded) onLoaded();

    // Auto-connect on page load if user has previously authorized successfully
    try {
      if (localStorage.getItem('phm-drive-autoconnect') === 'true') {
        _isManualConnect = false;
        ensureToken();
      }
    } catch (e) {}
  } catch (e: any) {
    driveErr('initTokenClient failed: ' + e.message);
  }
}

export function ensureToken(): Promise<string | null> {
  if (_token && _tokenExpiry > Date.now() + 10000) return Promise.resolve(_token);
  if (!_tokenClient) return Promise.resolve(null);
  return new Promise((resolve) => {
    _tokenResolvers.push(resolve);
    if (!_tokenRefreshing) {
      _tokenRefreshing = true;
      try {
        _tokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        _tokenRefreshing = false;
        const idx = _tokenResolvers.indexOf(resolve);
        if (idx >= 0) _tokenResolvers.splice(idx, 1);
        resolve(null);
      }
    }
  });
}

export function connectDrive() {
  _isManualConnect = true;
  const g = (window as any).google;
  if (!_tokenClient) {
    setupGIS();
  }
  if (!_tokenClient) {
    driveErr('Google sign-in library not loaded yet. Wait 2 seconds and try again.');
    return;
  }
  try {
    _tokenClient.requestAccessToken({ prompt: '' });
  } catch (e: any) {
    driveErr('requestAccessToken threw: ' + e.message);
  }
}

export function disconnectDrive() {
  _token = null;
  _tokenExpiry = 0;
  _driveReady = false;
  _rootId = null;
  try {
    localStorage.removeItem('phm-drive-autoconnect');
  } catch (e) {}
  if (onStatusChange) {
    onStatusChange('error', ''); // Silent disconnection (clears state, driveStatus returns to disconnected)
  }
}

function driveErr(msg: string) {
  if (onStatusChange) {
    onStatusChange('error', _isManualConnect ? msg : '');
  }
}

function _afterSignIn() {
  if (onStatusChange) {
    onStatusChange('connecting');
  }
  _ensureFolder('Project Hail Mary', null)
    .then((rootId) => {
      if (!rootId) throw new Error('Could not retrieve root ID');
      _rootId = rootId;
      return Promise.all([
        _ensureFolder('journal', rootId),
        _ensureFolder('projects', rootId),
        _ensureFolder('media', rootId)
      ]);
    })
    .then(() => {
      _driveReady = true;
      try {
        localStorage.setItem('phm-drive-autoconnect', 'true');
      } catch (e) {}
      if (onStatusChange) {
        onStatusChange('live');
      }
      if (onDataLoaded) {
        onDataLoaded();
      }
    })
    .catch((e) => {
      driveErr('Setup failed: ' + e.message);
    });
}

/* ==========================================
   Google Drive API REST Communications
   ========================================== */
export function df(method: string, path: string, body?: any, ct?: string): Promise<Response | null> {
  return ensureToken().then((token) => {
    if (!token) return null;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (ct) headers['Content-Type'] = ct;

    return fetch(`https://www.googleapis.com${path}`, {
      method,
      headers,
      body: body ? (typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body)) : undefined
    }).then((r) => {
      if (r.status === 204) return r;
      if (r.status === 401) {
        _token = null;
        _driveReady = false;
        driveErr('Session expired — reconnect');
        return null;
      }
      if (!r.ok) return null;
      return r;
    }).catch(() => null);
  });
}

export function djson(method: string, path: string, body?: any): Promise<any> {
  return df(
    method,
    path,
    body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    body ? 'application/json' : undefined
  ).then((r) => (r ? r.json() : null));
}

/* ==========================================
   Google Drive Folder & File Provisioners
   ========================================== */
const _fc: Record<string, string> = {};

export function _ensureFolder(name: string, parentId: string | null): Promise<string | null> {
  const k = `${parentId || 'root'}/${name}`;
  if (_fc[k]) return Promise.resolve(_fc[k]);

  const q = `name=${JSON.stringify(name)} and mimeType='application/vnd.google-apps.folder' and trashed=false${
    parentId ? ` and '${parentId}' in parents` : ''
  }`;

  return djson('GET', `/drive/v3/files?spaces=drive&fields=files(id)&q=${encodeURIComponent(q)}`)
    .then((r) => {
      if (r && r.files && r.files[0]) {
        _fc[k] = r.files[0].id;
        return r.files[0].id;
      }
      const meta: any = { name, mimeType: 'application/vnd.google-apps.folder' };
      if (parentId) meta.parents = [parentId];
      return djson('POST', '/drive/v3/files?fields=id', meta).then((r2) => {
        if (r2) {
          _fc[k] = r2.id;
          return r2.id;
        }
        return null;
      });
    });
}

export function ensurePath(parts: string[], base?: string): Promise<string | null> {
  return parts.reduce((p, n) => {
    return p.then((id) => {
      return id ? _ensureFolder(n, id) : null;
    });
  }, Promise.resolve(base || _rootId));
}

export function findFile(name: string, folderId: string): Promise<string | null> {
  const q = `name=${JSON.stringify(name)} and '${folderId}' in parents and trashed=false`;
  return djson('GET', `/drive/v3/files?spaces=drive&fields=files(id)&q=${encodeURIComponent(q)}`)
    .then((r) => (r && r.files && r.files[0] ? r.files[0].id : null));
}

export function writeFile(name: string, folderId: string, content: string, mimeType?: string): Promise<any> {
  const mime = mimeType || 'application/json';
  return findFile(name, folderId).then((existId) => {
    const b = `phm${Date.now()}`;
    const metaObj = existId ? { mimeType: mime } : { name, mimeType: mime, parents: [folderId] };
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metaObj)}` +
      `\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${b}--`;
    const url = existId ? `/upload/drive/v3/files/${existId}?uploadType=multipart&fields=id`
                        : `/upload/drive/v3/files?uploadType=multipart&fields=id`;
    return df(existId ? 'PATCH' : 'POST', url, body, `multipart/related; boundary=${b}`)
      .then((r) => (r ? r.json() : null));
  });
}

export function deleteFile(name: string, folderId: string): Promise<any> {
  return findFile(name, folderId).then((id) => {
    if (!id) return null;
    return df('DELETE', `/drive/v3/files/${id}`);
  });
}

export function readText(fileId: string): Promise<string | null> {
  return df('GET', `/drive/v3/files/${fileId}?alt=media`)
    .then((r) => (r ? r.text() : null));
}

export function writeBinary(name: string, folderId: string, bytes: Uint8Array, mimeType: string): Promise<any> {
  return findFile(name, folderId).then((existId) => {
    const b = `phm${Date.now()}`;
    const metaObj = existId ? { mimeType } : { name, mimeType, parents: [folderId] };
    const metaStr = JSON.stringify(metaObj);
    const metaPart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaStr}\r\n--${b}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const endPart = `\r\n--${b}--`;
    const metaBytes = strToU8(metaPart);
    const endBytes = strToU8(endPart);
    const body = concatBytes([metaBytes, bytes, endBytes]);
    const url = existId ? `/upload/drive/v3/files/${existId}?uploadType=multipart&fields=id`
                        : `/upload/drive/v3/files?uploadType=multipart&fields=id`;
    return df(existId ? 'PATCH' : 'POST', url, body, `multipart/related; boundary=${b}`)
      .then((r) => (r ? r.json() : null));
  });
}

export function listFiles(folderId: string): Promise<any[]> {
  return djson('GET', `/drive/v3/files?spaces=drive&fields=files(id,name)&q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}`)
    .then((r) => (r && r.files ? r.files : []));
}

export function buildEntryIndex(): Promise<Record<string, string>> {
  const all: Array<{ dk: string; id: string }> = [];
  function page(pt: string | null): Promise<Record<string, string>> {
    const url = `/drive/v3/files?spaces=drive&fields=files(id,name)&pageSize=1000` +
      `&q=${encodeURIComponent("trashed=false and (name contains '.docx' or name contains '.html')")}` +
      (pt ? `&pageToken=${pt}` : '');
    return djson('GET', url).then((r) => {
      if (!r) return {};
      (r.files || []).forEach((f: any) => {
        if (/^\d{8}\.(docx|html)$/i.test(f.name)) {
          all.push({ dk: f.name.slice(0, 8), id: f.id });
        }
      });
      if (r.nextPageToken) return page(r.nextPageToken);
      const idx: Record<string, string> = {};
      all.forEach((f) => {
        idx[f.dk] = f.id;
      });
      return idx;
    });
  }
  return page(null);
}

export function readDocxAsText(fileId: string): Promise<string | null> {
  return df('GET', `/drive/v3/files/${fileId}?alt=media`)
    .then((r) => (r ? r.arrayBuffer() : null))
    .then((ab) => {
      if (!ab) return null;
      return parseDocx(ab);
    })
    .catch(() => null);
}

/* ==========================================
   Binary Zip Decoder / Docx Parser
   ========================================== */
async function parseDocx(ab: ArrayBuffer): Promise<string | null> {
  try {
    const u8 = new Uint8Array(ab);
    let i = 0;
    while (i < u8.length - 30) {
      if (u8[i] !== 0x50 || u8[i + 1] !== 0x4B || u8[i + 2] !== 0x03 || u8[i + 3] !== 0x04) {
        i++;
        continue;
      }
      const flags = u8[i + 6] | (u8[i + 7] << 8);
      const method = u8[i + 8] | (u8[i + 9] << 8);
      const csize32 = u8[i + 18] | (u8[i + 19] << 8) | (u8[i + 20] << 16) | ((u8[i + 21] & 0x7f) << 24);
      const nlen = u8[i + 26] | (u8[i + 27] << 8);
      const xlen = u8[i + 28] | (u8[i + 29] << 8);
      const nameStr = new TextDecoder('utf-8', { fatal: false }).decode(u8.slice(i + 30, i + 30 + nlen));
      const dstart = i + 30 + nlen + xlen;

      let csize = csize32;
      if ((flags & 8) && csize === 0) {
        let j = dstart;
        while (j < u8.length - 4) {
          if ((u8[j] === 0x50 && u8[j + 1] === 0x4B && u8[j + 2] === 0x07 && u8[j + 3] === 0x08) ||
              (u8[j] === 0x50 && u8[j + 1] === 0x4B && u8[j + 2] === 0x03 && u8[j + 3] === 0x04)) {
            csize = j - dstart;
            break;
          }
          j++;
        }
      }

      if (nameStr === 'word/document.xml') {
        const data = u8.slice(dstart, dstart + csize);
        let xml = '';
        if (method === 0) {
          xml = new TextDecoder('utf-8', { fatal: false }).decode(data);
        } else if (method === 8) {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();
            writer.write(data);
            writer.close();
            const parts: Uint8Array[] = [];
            let tot = 0;
            while (true) {
              const ch = await reader.read();
              if (ch.done) break;
              parts.push(ch.value);
              tot += ch.value.length;
            }
            const out = new Uint8Array(tot);
            let off = 0;
            parts.forEach((p) => {
              out.set(p, off);
              off += p.length;
            });
            xml = new TextDecoder('utf-8', { fatal: false }).decode(out);
          }
        }
        if (xml && xml.indexOf('<w:') >= 0) {
          return xml
            .replace(/<w:br[^>]*\/>/g, '\n')
            .replace(/<w:cr\/>/g, '\n')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }
      }
      i = dstart + Math.max(csize, 1);
    }
  } catch (e) {}
  return null;
}

/* ==========================================
   Word Document Generation (.docx Builder)
   ========================================== */
function strToU8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concatBytes(arrs: Uint8Array[]): Uint8Array {
  const tot = arrs.reduce((n, a) => n + a.length, 0);
  const r = new Uint8Array(tot);
  let p = 0;
  arrs.forEach((a) => {
    r.set(a, p);
    p += a.length;
  });
  return r;
}

function crc32(data: Uint8Array): number {
  const t: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let k = 0; k < data.length; k++) {
    crc = t[(crc ^ data[k]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

class MiniZip {
  files: Array<{ name: string; data: Uint8Array }> = [];

  add(name: string, content: string) {
    const data = strToU8(content);
    this.files.push({ name, data });
  }

  build(): Uint8Array {
    const parts: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    this.files.forEach((f) => {
      const nameBytes = strToU8(f.name);
      const crc = crc32(f.data);

      // Local file header
      const lh = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, f.data.length, true);
      dv.setUint32(22, f.data.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);

      // Central directory entry
      const cd = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(cd.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, f.data.length, true);
      cdv.setUint32(24, f.data.length, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);

      parts.push(lh, f.data);
      centralDir.push(cd);
      offset += lh.length + f.data.length;
    });

    const cdBytes = concatBytes(centralDir);
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, this.files.length, true);
    edv.setUint16(10, this.files.length, true);
    edv.setUint32(12, cdBytes.length, true);
    edv.setUint32(16, offset, true);
    edv.setUint16(20, 0, true);

    return concatBytes([...parts, cdBytes, eocd]);
  }
}

function xmlEsc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function makeDocx(title: string, bodyText: string): Uint8Array {
  const paras = bodyText.split('\n').map((line) => {
    return `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r></w:p>`;
  }).join('');

  const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' +
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${xmlEsc(title)}</w:t></w:r></w:p>` +
    paras +
    '<w:sectPr/></w:body></w:document>';

  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:styleId="Heading1">' +
    '<w:name w:val="heading 1"/>' +
    '<w:rPr><w:b/><w:color w:val="0E7E78"/><w:sz w:val="32"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
    '<w:name w:val="Normal"/>' +
    '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/></w:rPr></w:style>' +
    '</w:styles>';

  const relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const appXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
    '<Application>Project Hail Mary</Application></Properties>';

  const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<dc:title>${xmlEsc(title)}</dc:title>` +
    '<dc:creator>Project Hail Mary</dc:creator></cp:coreProperties>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  const zip = new MiniZip();
  zip.add('[Content_Types].xml', contentTypes);
  zip.add('_rels/.rels', rootRels);
  zip.add('word/document.xml', docXml);
  zip.add('word/styles.xml', stylesXml);
  zip.add('word/_rels/document.xml.rels', relsXml);
  zip.add('docProps/app.xml', appXml);
  zip.add('docProps/core.xml', coreXml);

  return zip.build();
}

export function downloadDocx(filename: string, title: string, text: string) {
  const bytes = makeDocx(title, text);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
