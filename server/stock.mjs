// ---------------------------------------------------------------------------
// Free stock imagery, from two libraries chosen for their licensing.
//
//   Pexels - free for commercial use, no attribution required. Needs a free key.
//   NASA   - public domain, needs no key at all, and is the best source there is
//            for space, physics and earth science.
//
// Nothing here is auto-applied: the app asks for candidates and the creator
// picks. Generic stock dropped in blind is what makes a science video look
// cheap, so a human always chooses.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fetchRetrying } from './retry.mjs';

const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';
const NASA_ENDPOINT = 'https://images-api.nasa.gov/search';

/** One candidate image, in the shape the picker expects. */
const candidate = (o) => ({
  id: String(o.id),
  provider: o.provider,
  thumb: o.thumb,
  full: o.full,
  credit: o.credit,
  sourceUrl: o.sourceUrl || '',
  width: o.width || 0,
  height: o.height || 0,
});

async function searchPexels(apiKey, query, orientation, perPage) {
  if (!apiKey) return [];
  const url =
    PEXELS_ENDPOINT +
    '?query=' + encodeURIComponent(query) +
    '&per_page=' + perPage +
    '&orientation=' + (orientation === 'landscape' ? 'landscape' : 'portrait');

  const res = await fetchRetrying(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    if (res.status === 401) throw new Error('That Pexels API key was rejected. Copy it again from pexels.com/api.');
    if (res.status === 429) throw new Error('Pexels rate limit hit. Wait a minute and search again.');
    throw new Error('Pexels error ' + res.status + '.');
  }

  const data = await res.json();
  return (data.photos || []).map((p) =>
    candidate({
      id: 'pexels-' + p.id,
      provider: 'pexels',
      thumb: p.src && p.src.tiny,
      // Ask for the crop that matches the video, so we are not downloading a
      // huge landscape file to sit behind a vertical short.
      full: p.src && (orientation === 'landscape' ? p.src.large2x : p.src.portrait),
      credit: 'Photo by ' + (p.photographer || 'unknown') + ' on Pexels',
      sourceUrl: p.url,
      width: p.width,
      height: p.height,
    }),
  );
}

async function searchNasa(query, perPage) {
  const url = NASA_ENDPOINT + '?media_type=image&q=' + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA image library error ' + res.status + '.');

  const data = await res.json();
  const items = (data.collection && data.collection.items) || [];

  return items
    .slice(0, perPage)
    .map((item) => {
      const meta = (item.data && item.data[0]) || {};
      const thumb = item.links && item.links[0] && item.links[0].href;
      if (!thumb) return null;
      return candidate({
        id: 'nasa-' + (meta.nasa_id || Math.random().toString(36).slice(2)),
        provider: 'nasa',
        thumb,
        // NASA serves sized variants beside the thumbnail; medium is a good
        // compromise between a blurry thumb and a 40 MB original.
        full: thumb.replace('~thumb.jpg', '~medium.jpg'),
        credit: 'NASA' + (meta.center ? ' / ' + meta.center : ''),
        sourceUrl: 'https://images.nasa.gov/details/' + (meta.nasa_id || ''),
      });
    })
    .filter(Boolean);
}

/**
 * Candidates for one search term, from every enabled library, interleaved so
 * neither source dominates the grid.
 */
export async function searchStock({ pexelsKey, query, orientation, providers, perPage = 4 }) {
  const term = String(query || '').trim();
  if (!term) return [];

  const wanted = Array.isArray(providers) && providers.length ? providers : ['pexels', 'nasa'];
  const jobs = [];
  if (wanted.includes('pexels') && pexelsKey) jobs.push(searchPexels(pexelsKey, term, orientation, perPage));
  if (wanted.includes('nasa')) jobs.push(searchNasa(term, perPage));

  // One library being down or rate-limited must not lose the other's results.
  const settled = await Promise.allSettled(jobs);
  const lists = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failures = settled.filter((r) => r.status === 'rejected').map((r) => r.reason.message);

  if (!lists.length && failures.length) throw new Error(failures[0]);

  const merged = [];
  for (let i = 0; i < perPage * 2; i++) {
    for (const list of lists) if (list[i]) merged.push(list[i]);
    if (merged.length >= perPage * 2) break;
  }
  return merged.slice(0, perPage * 2);
}

/**
 * Fetch the chosen image onto disk so the render is reproducible and does not
 * depend on a remote host still being up. Same pattern as the voiceover clips.
 */
export async function downloadStock({ url, id, jobId, publicDir }) {
  if (!/^https:\/\//i.test(String(url || ''))) {
    throw new Error('That image address does not look safe to download.');
  }

  const dir = path.join(publicDir, 'generated', 'stock', jobId);
  fs.mkdirSync(dir, { recursive: true });

  let res = await fetch(url);
  // NASA's sized variants are not guaranteed to exist; fall back to the thumb.
  if (!res.ok && url.includes('~medium.jpg')) {
    res = await fetch(url.replace('~medium.jpg', '~thumb.jpg'));
  }
  if (!res.ok) throw new Error('Could not download that image (' + res.status + ').');

  const type = res.headers.get('content-type') || '';
  if (!/^image\//i.test(type)) throw new Error('That address did not return an image.');

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 12 * 1024 * 1024) throw new Error('That image is too large to use.');

  const ext = /png/i.test(type) ? '.png' : /webp/i.test(type) ? '.webp' : '.jpg';
  const safeId = String(id || 'img').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40);
  const fileName = safeId + ext;

  fs.writeFileSync(path.join(dir, fileName), buffer);
  return { src: 'generated/stock/' + jobId + '/' + fileName, bytes: buffer.length };
}
