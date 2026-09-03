// ---------------------------------------------------------------------------
// Turning a plain English noun into a drawable shape.
//
// The storyboard says "fish", not "mdi:fish". That split is deliberate and it
// is the same one `imageQuery` already uses for stock photos: the model names
// the THING, the server finds a picture of it. Asking a model for icon set
// identifiers gets you confident, well-formed, non-existent ones.
//
// The source is Iconify, which aggregates about 200,000 open source icons
// behind a free keyless API. Two endpoints are used:
//
//   /search?query=fish        which sets have a fish, and under what licence
//   /{prefix}.json?icons=...  the actual path data, batched per set
//
// Bodies are fetched once and cached, then travel INSIDE the script JSON to the
// renderer. Nothing here runs during a render. That is the important part: a
// frame must be a pure function of its inputs, and a frame that waits on a
// network call is neither pure nor fast, and fails differently on the fiftieth
// attempt than on the first.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fetchRetrying } from './retry.mjs';

const API = 'https://api.iconify.design';

/**
 * Which icon sets to take a match from, best first.
 *
 * Ordered by two things. Solid silhouettes beat hairline strokes, because these
 * are drawn 200px tall in a video and a 2px stroke at that size looks like a
 * mistake. And sets that need no attribution come before ones that do - a
 * creator monetising a video should not acquire a credit obligation because the
 * tool quietly preferred a prettier set.
 */
const PREFERRED = [
  { prefix: 'mdi', attribution: false },              // Apache 2.0, 7k icons, solid
  { prefix: 'material-symbols', attribution: false }, // Apache 2.0
  { prefix: 'ph', attribution: false },               // MIT, Phosphor
  { prefix: 'tabler', attribution: false },           // MIT
  { prefix: 'lucide', attribution: false },           // ISC
  { prefix: 'game-icons', attribution: true },        // CC BY 3.0 - needs a credit
];

const RANK = new Map(PREFERRED.map((p, i) => [p.prefix, i]));
export const NEEDS_ATTRIBUTION = new Set(PREFERRED.filter((p) => p.attribution).map((p) => p.prefix));

/** Cache path. Outside public/, which is wiped between jobs. */
function cacheFile(root) {
  return path.join(root, '.cache', 'icons.json');
}

function readCache(root) {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(root), 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(root, cache) {
  try {
    const file = cacheFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache));
  } catch {
    // A cache that cannot be written is a slower tool, not a broken one.
  }
}

/** Strip anything that is not a plain word, so "a big fish!" searches as "fish". */
export function searchTerm(noun) {
  const words = String(noun || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // Articles and adjectives dilute the match; the last noun is usually the thing.
    .filter((w) => !['a', 'an', 'the', 'of', 'big', 'small', 'large'].includes(w));
  return words.slice(0, 3).join(' ');
}

/**
 * Score a candidate. An exact name match is worth far more than set quality:
 * `lucide:dam` beats `mdi:water-damage` however good mdi is in general.
 */
function score(name, term) {
  const [prefix, icon = ''] = name.split(':');
  const setRank = RANK.has(prefix) ? RANK.get(prefix) : PREFERRED.length + 3;

  let match = 3;
  if (icon === term) match = 0;
  else if (icon.replace(/-/g, ' ') === term) match = 0;
  else if (icon.startsWith(term + '-')) match = 1;
  else if (icon.includes(term)) match = 2;

  // Outline variants of the same idea read worse at size than the filled one.
  const outline = /-(outline|line|thin|light)$/.test(icon) ? 1 : 0;

  return match * 100 + setRank * 10 + outline;
}

/** Ask Iconify which sets have this thing. Returns candidate names, best first. */
async function search(term) {
  const url = API + '/search?query=' + encodeURIComponent(term) + '&limit=32';
  const res = await fetchRetrying(url, {}, { attempts: 2, timeoutMs: 12000 });
  if (!res.ok) throw new Error('Icon search failed (' + res.status + ')');
  const data = await res.json();
  const names = Array.isArray(data.icons) ? data.icons : [];
  return names.slice().sort((a, b) => score(a, term) - score(b, term));
}

/**
 * Strip anything from an icon body that is not drawing.
 *
 * This markup is fetched from a third party and injected into the DOM by the
 * renderer, so it does not get to arrive unexamined - however reputable the
 * source and however unlikely a hostile icon is. Shapes and their attributes
 * survive; script tags, event handlers and external references do not.
 */
export function sanitizeBody(body) {
  return String(body || '')
    // Whole elements that can execute or reach outside the document.
    .replace(/<\s*(script|foreignObject|iframe|use|image)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|foreignObject|iframe|use|image)\b[^>]*\/?>/gi, '')
    // Event handlers, quoted or bare.
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Links, except same-document ones like url(#gradient).
    .replace(/\s(href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, (m) =>
      /=\s*["']#/.test(m) ? m : '')
    .replace(/javascript:/gi, '');
}

/** Fetch the path data for a set of names, one request per icon set. */
async function fetchBodies(names) {
  const byPrefix = new Map();
  for (const name of names) {
    const [prefix, icon] = name.split(':');
    if (!prefix || !icon) continue;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(icon);
  }

  const out = {};
  for (const [prefix, icons] of byPrefix) {
    const url = API + '/' + prefix + '.json?icons=' + encodeURIComponent(icons.join(','));
    const res = await fetchRetrying(url, {}, { attempts: 2, timeoutMs: 12000 });
    if (!res.ok) continue;
    const data = await res.json();
    // Set-level width/height are the default viewBox; an icon may override.
    const dw = Number(data.width) || 24;
    const dh = Number(data.height) || 24;
    for (const [icon, def] of Object.entries(data.icons || {})) {
      if (!def || typeof def.body !== 'string') continue;
      out[prefix + ':' + icon] = {
        body: sanitizeBody(def.body),
        width: Number(def.width) || dw,
        height: Number(def.height) || dh,
      };
    }
  }
  return out;
}

/**
 * Resolve one noun to a drawable icon.
 *
 * Returns null rather than throwing when nothing matches. A missing icon should
 * cost you one shape in one scene, not the whole storyboard - the stage falls
 * back to drawing a labelled disc, which is worse but not broken.
 */
export async function resolveIcon(noun, { root, cache }) {
  const term = searchTerm(noun);
  if (!term) return null;

  if (cache[term] !== undefined) return cache[term];

  let resolved = null;
  try {
    const candidates = await search(term);
    if (candidates.length) {
      // Try the best few, because a name can be listed by search and still be
      // absent from the data endpoint (aliases, renamed icons).
      const bodies = await fetchBodies(candidates.slice(0, 4));
      for (const name of candidates) {
        if (bodies[name]) {
          resolved = { name, ...bodies[name], attribution: NEEDS_ATTRIBUTION.has(name.split(':')[0]) };
          break;
        }
      }
    }
  } catch (err) {
    console.log('[icons] "' + term + '" failed: ' + (err && err.message));
    // Not cached: a network blip should not poison the term for the session.
    return null;
  }

  cache[term] = resolved;
  return resolved;
}

/**
 * Fill in the artwork for every actor in a storyboard, in place.
 *
 * Called once after the script is written. Every distinct noun costs at most
 * two requests, and the disk cache means the second video about dams costs
 * none at all.
 */
export async function attachIcons(content, { root }) {
  // Two shapes reach this. Fresh content carries `script`; the render route is
  // handed a flattened timeline that carries `scenes`. Both hold the same
  // panels, and a motion scene added by hand in the editor only ever appears
  // in the second, so both are walked.
  const lines = [
    ...(Array.isArray(content && content.script) ? content.script : []),
    ...(Array.isArray(content && content.scenes) ? content.scenes : []),
  ];
  const actors = [];
  for (const line of lines) {
    const list = line && line.panel && line.panel.actors;
    if (Array.isArray(list)) actors.push(...list);
  }
  if (!actors.length) return { resolved: 0, missing: [], attribution: [] };

  const cache = readCache(root);
  const before = Object.keys(cache).length;

  const missing = [];
  const attribution = new Set();
  let resolved = 0;

  for (const actor of actors) {
    // Already drawn once. This is what makes it safe to call again before a
    // render, to catch a motion scene somebody added by hand in the editor.
    if (actor.art && actor.art.body) continue;
    const icon = await resolveIcon(actor.icon, { root, cache });
    if (!icon) {
      missing.push(actor.icon);
      continue;
    }
    // The noun stays as the accessible name; art is what the renderer draws.
    actor.art = { body: icon.body, width: icon.width, height: icon.height };
    actor.iconName = icon.name;
    if (icon.attribution) attribution.add(icon.name.split(':')[0]);
    resolved++;
  }

  if (Object.keys(cache).length !== before) writeCache(root, cache);

  return { resolved, missing, attribution: [...attribution] };
}
