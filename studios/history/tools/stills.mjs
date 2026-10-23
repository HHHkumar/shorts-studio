// Render a few frames of a saved project to PNGs, to check the look without a full render.
//
//   node --import ./tools/ts-resolve.mjs tools/stills.mjs <projectId> <outDir> [seconds...]

import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { buildTimeline } from '../src/lib/timeline.ts';
import { migrateProject } from '../src/lib/migrate.ts';
import { MEDIA_DIR, PUBLIC_DIR, readProject, ROOT } from '../server/projects.mjs';

const [id, outDir, ...times] = process.argv.slice(2);
if (!id || !outDir) {
  console.log('usage: tools/stills.mjs <projectId> <outDir> [seconds...]');
  process.exit(1);
}
// Opened as the studio opens it, so settings added since it was saved get their defaults.
const project = migrateProject(readProject(id));
const props = buildTimeline(project);
const pub = path.join(ROOT, '.cache', 'stills-public');
fs.rmSync(pub, { recursive: true, force: true });
fs.mkdirSync(path.join(pub, 'projects'), { recursive: true });
// Every project folder the video draws on: usually its own, but a copied project still points at the original's.
const folders = new Set([id, ...(JSON.stringify(project).match(/projects\/[A-Za-z0-9_-]+\//g) || []).map((m) => m.split('/')[1])]);
for (const f of folders) {
  if (fs.existsSync(path.join(MEDIA_DIR, f))) fs.cpSync(path.join(MEDIA_DIR, f), path.join(pub, 'projects', f), { recursive: true });
}
for (const folder of ['audio', 'fonts']) fs.cpSync(path.join(PUBLIC_DIR, folder), path.join(pub, folder), { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'), publicDir: pub });
const composition = await selectComposition({ serveUrl, id: 'HistoryVideo', inputProps: props });
fs.mkdirSync(outDir, { recursive: true });
const seconds = times.length ? times.map(Number) : [1, 5, 12];
for (const s of seconds) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * 30));
  const output = path.join(outDir, 'still-' + String(s).replace('.', '_') + 's.png');
  await renderStill({ composition, serveUrl, inputProps: props, frame, output, scale: 0.5 });
  console.log('wrote', output);
}
