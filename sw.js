const CACHE = 'phm-v3';
const CORE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function _isSafeToCache(request, response) {
  if (!response || !response.ok) return false;
  const url = request.url || '';
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('gsi/client')) return false;
  const ct = response.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return false;
  return true;
}

self.addEventListener('fetch', e => {
  const url = e.request.url;

  /* Always go to network for Google APIs — never cache auth or Drive calls */
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('gsi/client')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
    return;
  }

  /* Network-first for HTML navigation — ensures Netlify deploys are always picked up */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        if (_isSafeToCache(e.request, r)) {
          const clone = r.clone();
          caches.open(CACHE).then(c => { try { c.put(e.request, clone); } catch(err) {} });
        }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  /* Cache-first for other app shell assets (icons, manifest) */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (_isSafeToCache(e.request, r) && e.request.method === 'GET') {
          const clone = r.clone();
          caches.open(CACHE).then(c => { try { c.put(e.request, clone); } catch(err) {} });
        }
        return r;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
