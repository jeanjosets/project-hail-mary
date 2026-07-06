export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function keyOf(y: number, m: number, d: number): string {
  return `${y}${pad(m + 1)}${pad(d)}`;
}

export function todayKey(): string {
  const n = new Date();
  return keyOf(n.getFullYear(), n.getMonth(), n.getDate());
}

export function utc(k: string): number {
  return Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function dayNumber(k: string): number {
  return Math.floor((utc(k) - Date.UTC(1998, 0, 19)) / 86400000) + 1;
}

export function fmtLong(k: string): string {
  return new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function fmtMed(k: string): string {
  return new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function k2i(k: string): string {
  return k ? `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}` : '';
}

export function i2k(v: string): string {
  return v ? v.replace(/-/g, '') : '';
}

export function uid(p: string): string {
  return p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
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

export function cleanEntryText(text: string): string {
  if (!text) return text;
  const dateRx = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\d+\s+\w+\s+\d{4}\s*$/;
  const lines = text.split('\n');
  while (lines.length && (lines[0].trim() === '' || dateRx.test(lines[0].trim()) || /^=+/.test(lines[0].trim()))) {
    lines.shift();
  }
  return lines.join('\n').trim();
}

export function preview50(t: string): string {
  const clean = t.includes('<') ? stripHtml(t) : t;
  const w = clean.trim().split(/\s+/);
  return w.slice(0, 50).join(' ') + (w.length > 50 ? '…' : '');
}

export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const x = Math.floor(s % 60);
  return `${m}:${pad(x)}`;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const DEFAULT_CATS = ['Learning', 'Health', 'Fitness', 'Travel', 'Career', 'Study', 'Creative', 'Faith', 'Personal'];

export const VERSES: [string, string][] = [
  ['Psalm 118:24', 'This is the day which the LORD hath made; we will rejoice and be glad in it.'],
  ['Psalm 90:12', 'So teach us to number our days, that we may apply our hearts unto wisdom.'],
  ['Joshua 1:9', 'Be strong and of a good courage; be not afraid, for the LORD thy God is with thee whithersoever thou goest.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Proverbs 3:5', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'],
  ['Isaiah 40:31', 'They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles.'],
  ['Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
  ['Matthew 6:34', 'Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself.'],
  ['Jeremiah 29:11', 'For I know the thoughts that I think toward you, thoughts of peace, to give you an expected end.'],
  ['Romans 8:28', 'And we know that all things work together for good to them that love God.'],
  ['Psalm 46:10', 'Be still, and know that I am God.'],
  ['2 Corinthians 5:7', 'For we walk by faith, not by sight.'],
  ['Psalm 27:1', 'The LORD is my light and my salvation; whom shall I fear?'],
  ['Lamentations 3:23', 'They are new every morning: great is thy faithfulness.'],
  ['Proverbs 16:3', 'Commit thy works unto the LORD, and thy thoughts shall be established.'],
  ['Psalm 37:5', 'Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.'],
  ['Matthew 11:28', 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'],
  ['Galatians 6:9', 'Let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
  ['Psalm 121:1', 'I will lift up mine eyes unto the hills, from whence cometh my help.'],
  ['Proverbs 4:23', 'Keep thy heart with all diligence; for out of it are the issues of life.'],
  ['Isaiah 41:10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God.'],
  ['Ecclesiastes 3:1', 'To every thing there is a season, and a time to every purpose under the heaven.'],
  ['Micah 6:8', '...to do justly, and to love mercy, and to walk humbly with thy God.'],
  ['John 8:12', 'I am the light of the world: he that followeth me shall not walk in darkness.'],
  ['Psalm 56:3', 'What time I am afraid, I will trust in thee.'],
  ['Colossians 3:23', 'Whatsoever ye do, do it heartily, as to the Lord, and not unto men.'],
  ['Hebrews 11:1', 'Now faith is the substance of things hoped for, the evidence of things not seen.'],
  ['Psalm 139:14', 'I will praise thee; for I am fearfully and wonderfully made.'],
  ['Zephaniah 3:17', 'The LORD thy God in the midst of thee is mighty; he will save.'],
  ['Philippians 4:6', 'Be careful for nothing; but in every thing by prayer let your requests be made known unto God.']
];

export function verseOfDay(): [string, string] {
  const tk = todayKey();
  const index = ((dayNumber(tk) % VERSES.length) + VERSES.length) % VERSES.length;
  return VERSES[index];
}

export function buildModel(texts: string[]) {
  const bi: Record<string, Record<string, number>> = {};
  const uni: Record<string, number> = {};

  texts.forEach((t) => {
    const w = (t.toLowerCase().match(/[a-z']+/g) || []);
    for (let i = 0; i < w.length; i++) {
      uni[w[i]] = (uni[w[i]] || 0) + 1;
      if (i > 0) {
        const p = w[i - 1];
        if (!bi[p]) bi[p] = {};
        bi[p][w[i]] = (bi[p][w[i]] || 0) + 1;
      }
    }
  });
  return { bi, uni };
}

export function predict(m: { bi: Record<string, Record<string, number>>, uni: Record<string, number> }, text: string) {
  const w = (text.toLowerCase().match(/[a-z']+/g) || []);
  const last = w[w.length - 1];
  const open = /[\s.,!?\n]$/.test(text) || text === '';

  function top(o: Record<string, number>): string[] {
    return Object.keys(o || {})
      .map((k) => [k, o[k]] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((x) => x[0]);
  }

  if (!open && last) {
    const c: Record<string, number> = {};
    Object.keys(m.uni).forEach((k) => {
      if (k.indexOf(last) === 0 && k !== last) c[k] = m.uni[k];
    });
    return { mode: 'complete', words: top(c) };
  }

  if (open && last && m.bi[last]) {
    return { mode: 'next', words: top(m.bi[last]) };
  }
  return { mode: 'next', words: top(m.uni) };
}

export function tidy(s: string): string {
  return s
    .replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/\bi\b/g, 'I')
    .replace(/(\w)'(\w)/g, '$1\u2019$2');
}

export function getJournalFolderParts(dk: string): string[] {
  const y = dk.slice(0, 4);
  const m = dk.slice(4, 6);
  return ['journal', y, `${y}${m}_${MONTHS[+m - 1].toLowerCase()}`];
}
