// ---------------------------------------------------------------------------
// Free and openly licensed photos and videos: real places and real people.
//
//   Pexels     photos + videos   free key   Pexels licence (no attribution required)
//   Pixabay    photos + videos   free key   Pixabay licence (no attribution required)
//   Wikimedia  photos            no key     public domain / CC0 / CC BY / CC BY-SA - real people, landmarks, history
//   Openverse  photos            no key     openly licensed images gathered from many sites
//   NASA       photos            no key     public domain
//
// A YouTube video counts as commercial use, and every picture is cropped and
// zoomed by the camera - so only licences that allow BOTH are offered. Anything
// non-commercial (NC), no-derivatives (ND) or non-free is filtered out here,
// before it can be picked. Every candidate carries its credit, and the ones
// whose licence requires attribution say so.
//
// Nothing is applied blind: the app shows candidates and a person picks (or
// presses "fill empty shots" knowingly).
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';

const UA = 'HistoryStudio/1.0 (personal video tool; contact via GitHub HHHkumar)';

export const PROVIDERS = [
  { id: 'pexels', label: 'Pexels', photos: true, videos: true, key: 'pexels' },
  { id: 'pixabay', label: 'Pixabay', photos: true, videos: true, key: 'pixabay' },
  { id: 'wikimedia', label: 'Wikimedia Commons', photos: true, videos: false, key: '' },
  { id: 'openverse', label: 'Openverse', photos: true, videos: false, key: '' },
  { id: 'nasa', label: 'NASA', photos: true, videos: false, key: '' },
];

const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** One candidate, the same shape whatever the library. */
function candidate(o) {
  return {
    id: String(o.id),
    provider: o.provider,
    type: o.type,
    thumb: o.thumb || '',
    full: o.full || '',
    preview: o.preview || '',
    width: o.width || 0,
    height: o.height || 0,
    duration: o.duration || 0,
    title: stripHtml(o.title).slice(0, 160),
    credit: {
      source: o.source,
      author: stripHtml(o.author).slice(0, 120) || 'Unknown',
      authorUrl: o.authorUrl || '',
      license: o.license || '',
      licenseUrl: o.licenseUrl || '',
      pageUrl: o.pageUrl || '',
      required: Boolean(o.required),
    },
  };
}

/**
 * Is this licence safe for a monetised video that crops and zooms the picture?
 * Public domain, CC0, CC BY and CC BY-SA: yes. NC, ND, "fair use", unknown: no.
 */
export function licenceAllowed(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use|non-?free|all rights reserved|copyright/.test(n)) return false;
  return /public domain|^pd|\bpd\b|pdm|cc0|cc-?zero|cc[ -]?by(-?sa)?\b|\bby(-sa)?\b|attribution/.test(n);
}

/** CC0 and public domain need no credit; CC BY and BY-SA do. */
export const needsAttribution = (name) => /\bby\b|attribution|cc[ -]?by/i.test(String(name || '')) && !/cc0|public domain|pdm/i.test(String(name || ''));

// --- Pexels -------------------------------------------------------------------------------

async function pexels(key, q, type, n) {
  if (!key) return [];
  const url = type === 'video'
    ? 'https://api.pexels.com/videos/search?orientation=landscape&size=medium&per_page=' + n + '&query=' + encodeURIComponent(q)
    : 'https://api.pexels.com/v1/search?orientation=landscape&per_page=' + n + '&query=' + encodeURIComponent(q);
  const res = await fetchRetrying(url, { headers: { Authorization: key } }, { attempts: 2, timeoutMs: 20000 });
  if (res.status === 401) throw new Error('That Pexels key was rejected. Copy it again from pexels.com/api.');
  if (res.status === 429) throw new Error('Pexels rate limit hit. Wait a minute.');
  if (!res.ok) throw new Error('Pexels error ' + res.status + '.');
  const data = await res.json();
  if (type === 'video') {
    return (data.videos || []).map((v) => {
      const files = (v.video_files || []).filter((f) => f.file_type === 'video/mp4' && f.link);
      // The largest file up to 1920 wide; the smallest one for the hover preview.
      const best = files.filter((f) => (f.width || 0) <= 1920).sort((a, b) => (b.width || 0) - (a.width || 0))[0] || files[0];
      const small = files.slice().sort((a, b) => (a.width || 0) - (b.width || 0))[0];
      if (!best) return null;
      return candidate({
        id: 'pexels-v' + v.id, provider: 'pexels', type: 'video', source: 'Pexels',
        thumb: v.image, full: best.link, preview: small && small.link, width: best.width, height: best.height, duration: v.duration,
        title: (v.url || '').split('/').filter(Boolean).pop()?.replace(/-\d+$/, '').replace(/-/g, ' '),
        author: v.user && v.user.name, authorUrl: v.user && v.user.url, license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', pageUrl: v.url,
      });
    }).filter(Boolean);
  }
  return (data.photos || []).map((p) => candidate({
    id: 'pexels-' + p.id, provider: 'pexels', type: 'photo', source: 'Pexels',
    thumb: p.src && p.src.medium, full: p.src && (p.src.large2x || p.src.original), width: p.width, height: p.height,
    title: p.alt, author: p.photographer, authorUrl: p.photographer_url, license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', pageUrl: p.url,
  }));
}

// --- Pixabay ------------------------------------------------------------------------------

async function pixabay(key, q, type, n) {
  if (!key) return [];
  const per = Math.max(3, Math.min(200, n));
  const url = (type === 'video' ? 'https://pixabay.com/api/videos/?' : 'https://pixabay.com/api/?image_type=photo&orientation=horizontal&')
    + 'safesearch=true&per_page=' + per + '&key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(q.slice(0, 100));
  const res = await fetchRetrying(url, {}, { attempts: 2, timeoutMs: 20000 });
  if (res.status === 400 && /key/i.test(await res.clone().text())) throw new Error('That Pixabay key was rejected. Copy it again from pixabay.com/api/docs.');
  if (res.status === 429) throw new Error('Pixabay rate limit hit. Wait a minute.');
  if (!res.ok) throw new Error('Pixabay error ' + res.status + '.');
  const data = await res.json();
  const common = (h) => ({ source: 'Pixabay', author: h.user, authorUrl: h.user_id ? 'https://pixabay.com/users/' + encodeURIComponent(h.user) + '-' + h.user_id + '/' : '', license: 'Pixabay Content License', licenseUrl: 'https://pixabay.com/service/license-summary/', pageUrl: h.pageURL, title: h.tags });
  if (type === 'video') {
    return (data.hits || []).map((h) => {
      const v = h.videos || {};
      const best = (v.large && v.large.url && v.large.width <= 1920 ? v.large : null) || v.medium || v.small || v.large;
      if (!best || !best.url) return null;
      return candidate({ id: 'pixabay-v' + h.id, provider: 'pixabay', type: 'video', thumb: best.thumbnail || (v.tiny && v.tiny.thumbnail), full: best.url, preview: (v.tiny || v.small || best).url, width: best.width, height: best.height, duration: h.duration, ...common(h) });
    }).filter(Boolean);
  }
  return (data.hits || []).map((h) => candidate({ id: 'pixabay-' + h.id, provider: 'pixabay', type: 'photo', thumb: h.webformatURL, full: h.largeImageURL, width: h.imageWidth, height: h.imageHeight, ...common(h) }));
}

// --- Wikimedia Commons ----------------------------------------------------------------------

async function wikimedia(q, n) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6'
    + '&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') + '&gsrlimit=' + Math.min(40, n * 3)
    + '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1920';
  const res = await fetchRetrying(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }, { attempts: 2, timeoutMs: 20000 });
  if (!res.ok) throw new Error('Wikimedia Commons error ' + res.status + '.');
  const data = await res.json();
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const info = p.imageinfo && p.imageinfo[0];
    if (!info || !/^image\/(jpeg|png|webp)/.test(info.mime || '')) continue;
    const m = info.extmetadata || {};
    const licence = (m.LicenseShortName && m.LicenseShortName.value) || (m.UsageTerms && m.UsageTerms.value) || '';
    if (m.NonFree && String(m.NonFree.value) === 'true') continue;
    if (!licenceAllowed(licence)) continue;
    if ((info.width || 0) < 800) continue; // too small to fill a 1080p frame
    out.push(candidate({
      id: 'wikimedia-' + p.pageid, provider: 'wikimedia', type: 'photo', source: 'Wikimedia Commons',
      thumb: info.thumburl ? info.thumburl.replace(/\/\d+px-/, '/480px-') : info.url,
      full: info.thumburl || info.url, width: info.thumbwidth || info.width, height: info.thumbheight || info.height,
      title: (m.ObjectName && m.ObjectName.value) || String(p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
      author: (m.Artist && m.Artist.value) || (m.Credit && m.Credit.value),
      license: licence, licenseUrl: (m.LicenseUrl && m.LicenseUrl.value) || '', pageUrl: info.descriptionurl,
      required: needsAttribution(licence) || (m.AttributionRequired && String(m.AttributionRequired.value) === 'true'),
    }));
    if (out.length >= n) break;
  }
  return out;
}

// --- Openverse --------------------------------------------------------------------------------

const OPENVERSE_LICENCES = { by: 'CC BY', 'by-sa': 'CC BY-SA', cc0: 'CC0', pdm: 'Public domain' };

async function openverse(q, n) {
  const url = 'https://api.openverse.org/v1/images/?license_type=commercial,modification&mature=false&page_size=' + Math.min(40, n)
    + '&q=' + encodeURIComponent(q);
  const res = await fetchRetrying(url, { headers: { 'User-Agent': UA } }, { attempts: 2, timeoutMs: 20000 });
  if (res.status === 429) throw new Error('Openverse rate limit hit. Wait a minute.');
  if (!res.ok) throw new Error('Openverse error ' + res.status + '.');
  const data = await res.json();
  return (data.results || [])
    .filter((r) => OPENVERSE_LICENCES[r.license] && (!r.width || r.width >= 800))
    .map((r) => {
      const licence = OPENVERSE_LICENCES[r.license] + (r.license_version && !['cc0', 'pdm'].includes(r.license) ? ' ' + r.license_version : '');
      return candidate({
        id: 'openverse-' + r.id, provider: 'openverse', type: 'photo', source: 'Openverse' + (r.source ? ' / ' + r.source : ''),
        thumb: r.thumbnail || r.url, full: r.url, width: r.width, height: r.height, title: r.title,
        author: r.creator, authorUrl: r.creator_url, license: licence, licenseUrl: r.license_url, pageUrl: r.foreign_landing_url,
        required: needsAttribution(licence),
      });
    });
}

// --- NASA ---------------------------------------------------------------------------------------

async function nasa(q, n) {
  const res = await fetchRetrying('https://images-api.nasa.gov/search?media_type=image&q=' + encodeURIComponent(q), {}, { attempts: 2, timeoutMs: 20000 });
  if (!res.ok) throw new Error('NASA image library error ' + res.status + '.');
  const data = await res.json();
  return ((data.collection && data.collection.items) || []).slice(0, n).map((item) => {
    const meta = (item.data && item.data[0]) || {};
    const thumb = item.links && item.links[0] && item.links[0].href;
    if (!thumb) return null;
    return candidate({
      id: 'nasa-' + (meta.nasa_id || ''), provider: 'nasa', type: 'photo', source: 'NASA',
      thumb, full: thumb.replace('~thumb.jpg', '~large.jpg'), title: meta.title,
      author: 'NASA' + (meta.center ? ' / ' + meta.center : ''), license: 'Public domain (NASA)', licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
      pageUrl: 'https://images.nasa.gov/details/' + (meta.nasa_id || ''),
    });
  }).filter(Boolean);
}

/**
 * Search the chosen libraries for photos or videos. One library failing never
 * loses the others' results; its message comes back in `notes`.
 */
export async function searchStock({ query, type = 'photo', providers, keys = {}, perProvider = 12, relax = true }) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) return { results: [], notes: [], query: '' };
  const first = await searchOnce({ q, type, providers, keys, perProvider });
  // Too specific finds nothing: "monsoon clouds roll over Mumbai" -> "monsoon clouds roll" -> "monsoon clouds".
  const words = q.split(/\s+/);
  if (!relax || first.results.length || words.length <= 2) return { ...first, query: q };
  for (const n of [3, 2]) {
    if (words.length <= n) continue;
    const shorter = words.slice(0, n).join(' ');
    const again = await searchOnce({ q: shorter, type, providers, keys, perProvider });
    if (again.results.length) return { ...again, query: shorter, notes: [...again.notes, 'Nothing for "' + q + '", so this shows "' + shorter + '".'] };
  }
  return { ...first, query: q };
}

async function searchOnce({ q, type, providers, keys, perProvider }) {
  const wanted = (Array.isArray(providers) && providers.length ? providers : PROVIDERS.map((p) => p.id))
    .filter((id) => PROVIDERS.some((p) => p.id === id && (type === 'video' ? p.videos : p.photos)));
  const jobs = wanted.map((id) => {
    if (id === 'pexels') return pexels(keys.pexels, q, type, perProvider);
    if (id === 'pixabay') return pixabay(keys.pixabay, q, type, perProvider);
    if (id === 'wikimedia') return wikimedia(q, perProvider);
    if (id === 'openverse') return openverse(q, perProvider);
    return nasa(q, perProvider);
  });
  const settled = await Promise.allSettled(jobs);
  const notes = [];
  const lists = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    notes.push(PROVIDERS.find((p) => p.id === wanted[i]).label + ': ' + ((r.reason && r.reason.message) || 'failed'));
    return [];
  });
  wanted.forEach((id, i) => {
    const p = PROVIDERS.find((x) => x.id === id);
    if (p.key && !keys[p.key] && !lists[i].length) notes.push(p.label + ': add a free key on the Keys step to search it.');
  });
  // Interleave, so no library crowds out the rest.
  const results = [];
  for (let i = 0; i < perProvider; i++) for (const list of lists) if (list[i]) results.push(list[i]);
  return { results, notes };
}

/** Hosts a chosen file may be downloaded from, per library. Openverse points at many sites, so it is checked by type instead. */
const HOSTS = {
  pexels: /(^|\.)pexels\.com$/,
  pixabay: /(^|\.)pixabay\.com$/,
  wikimedia: /(^|\.)wikimedia\.org$/,
  nasa: /(^|\.)nasa\.gov$/,
};

/** Fetch a picked candidate. Returns { buffer, ext, type }. Size-capped and type-checked. */
export async function downloadCandidate(c) {
  const url = String((c && c.full) || '');
  let host = '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new Error('');
    host = u.hostname;
  } catch {
    throw new Error('That file address does not look safe to download.');
  }
  const rule = HOSTS[c.provider];
  if (rule && !rule.test(host)) throw new Error('That file is not on ' + c.provider + '’s own servers, so it was not downloaded.');
  const video = c.type === 'video';
  let res = await fetchRetrying(url, { headers: { 'User-Agent': UA } }, { attempts: 2, timeoutMs: video ? 180000 : 60000 });
  if (!res.ok && c.provider === 'nasa') res = await fetchRetrying(url.replace('~large.jpg', '~medium.jpg'), {}, { attempts: 1 });
  if (!res.ok) throw new Error('Could not download that file (' + res.status + ').');
  const type = res.headers.get('content-type') || '';
  if (video ? !/^video\/(mp4|webm)/i.test(type) : !/^image\/(jpeg|png|webp)/i.test(type)) {
    throw new Error('That address did not return ' + (video ? 'a video' : 'a picture') + ' (' + (type || 'unknown type') + ').');
  }
  const cap = video ? 150 * 1024 * 1024 : 25 * 1024 * 1024;
  const length = Number(res.headers.get('content-length') || 0);
  if (length > cap) throw new Error('That file is too large (' + Math.round(length / 1048576) + ' MB).');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > cap) throw new Error('That file is too large.');
  const ext = video ? (/webm/i.test(type) ? '.webm' : '.mp4') : /png/i.test(type) ? '.png' : /webp/i.test(type) ? '.webp' : '.jpg';
  return { buffer, ext, type: video ? 'video' : 'photo' };
}
