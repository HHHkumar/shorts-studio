// ---------------------------------------------------------------------------
// Google Flow and Flow Music, the hand-off way.
//
// Neither has an official API, and driving someone's subscription through an
// unofficial one risks their account - so the studio prepares everything to
// paste into them and takes the results back:
//
//   motionPrompts   what moves in each picture, written for Veo's Frames to Video
//   musicBriefs     one brief per chapter, written for Flow Music (Lyria)
//   writePack       a folder: numbered start frames, character ingredients,
//                   the prompts in the same order, and how to use them
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, readMedia } from './projects.mjs';

const clean = (v) => (typeof v === 'string' ? v : '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// --- motion prompts ------------------------------------------------------------------

export const MOTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    shots: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'The shot label exactly as given, e.g. 3b.' },
          prompt: { type: 'STRING', description: 'The motion prompt for this shot.' },
        },
        required: ['label', 'prompt'],
        propertyOrdering: ['label', 'prompt'],
      },
    },
  },
  required: ['shots'],
  propertyOrdering: ['shots'],
};

export const MOTION_SYSTEM = [
  'You write motion prompts for Google Veo image-to-video (Flow "Frames to Video"). The image is the first frame;',
  'your prompt says only what happens next. For each shot write 2-4 sentences:',
  '1. What moves: people act naturally and specifically (she wrings out a wet reed mat; he fans the embers), cloth and',
  '   hair move, the environment is alive (heat shimmer, dust in light, smoke, water).',
  '2. The camera move, in film language (slow dolly in, gentle pan right, static, handheld).',
  '3. Sound: ambient only, naming it (wind, distant market, crackling fire). No dialogue, no speech, no music.',
  'Always end with: "Keep the exact illustrated art style, characters and composition of the first frame. No text, no captions."',
  'Subtle beats spectacular: 6-8 seconds of believable, small motion. Never add new characters or change the setting.',
].join('\n');


// --- music briefs ----------------------------------------------------------------------

export const MUSIC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'The section label exactly as given.' },
          prompt: { type: 'STRING', description: 'The music brief.' },
        },
        required: ['label', 'prompt'],
        propertyOrdering: ['label', 'prompt'],
      },
    },
  },
  required: ['sections'],
  propertyOrdering: ['sections'],
};

export const MUSIC_SYSTEM = [
  'You are the music supervisor for a narrated, illustrated history documentary on YouTube.',
  'For each section write one brief to paste into Google Flow Music (Lyria). Each brief, 3-5 sentences, gives:',
  '- style and instrumentation authentic to the era and region of the story (e.g. ancient India: bansuri, tanpura drone,',
  '  soft pakhawaj or tabla; ancient Egypt: ney flute, oud, frame drum; medieval Europe: lute, hurdy-gurdy, recorder),',
  '  blended with a gentle modern cinematic underscore;',
  '- the mood of that section and how it moves (starts sparse, builds a little, resolves);',
  '- tempo in BPM and the length in minutes:seconds (as given);',
  '- that it is INSTRUMENTAL ONLY, NO VOCALS, NO LYRICS, sits under a voiceover (sparse in the mid-range, no busy melody',
  '  over speech), and has no abrupt ending.',
  'Neighbouring sections should feel like one score: shared instruments and key, different energy.',
].join('\n');


// --- the pack --------------------------------------------------------------------------

const safe = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'video';

/**
 * Write a Flow pack into out/. `items`: [{ label, image, prompt }]; `ingredients`:
 * [{ name, image }]; `music`: [{ label, prompt }]. Returns the folder name.
 */
export function writePack(outDir, { title, items, ingredients = [], music = [] }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const folder = 'flow-pack-' + safe(title) + '-' + stamp;
  const dir = path.join(outDir, folder);
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });

  const written = [];
  for (const it of items || []) {
    const bytes = readMedia(it.image);
    if (!bytes) continue;
    const label = String(it.label).replace(/[^0-9a-z]/gi, '');
    const name = label.replace(/^(\d+)/, (n) => n.padStart(2, '0')) + path.extname(it.image).toLowerCase();
    fs.writeFileSync(path.join(dir, 'frames', name), bytes);
    written.push({ ...it, file: 'frames/' + name, clip: name.replace(/\.[a-z]+$/, '.mp4') });
  }
  if (!written.length) throw new Error('None of the ticked shots has a picture yet. Draw or upload them first.');

  const ingr = [];
  if (ingredients.length) {
    fs.mkdirSync(path.join(dir, 'ingredients'), { recursive: true });
    for (const ing of ingredients) {
      const bytes = readMedia(ing.image);
      if (!bytes) continue;
      const name = safe(ing.name) + path.extname(ing.image).toLowerCase();
      fs.writeFileSync(path.join(dir, 'ingredients', name), bytes);
      ingr.push(name);
    }
  }

  const prompts = written.map((w) => '=== ' + w.label + '  (start frame: ' + w.file + '  ->  save the clip as ' + w.clip + ')\n' + w.prompt).join('\n\n');
  fs.writeFileSync(path.join(dir, 'prompts.txt'), prompts + '\n');
  if (music.length) {
    fs.writeFileSync(path.join(dir, 'music-prompts.txt'), music.map((m) => '=== ' + m.label + '\n' + m.prompt).join('\n\n') + '\n');
  }
  fs.writeFileSync(path.join(dir, 'HOW-TO.txt'), [
    'Flow pack for: ' + (title || 'your video'),
    '',
    'VIDEO CLIPS (Google Flow, labs.google/fx/tools/flow)',
    '1. New project in Flow. Choose "Frames to Video", 16:9, Veo 3.1 (Fast is fine for most shots).',
    '2. For each entry in prompts.txt: add the start frame from the frames folder, paste its prompt, generate.',
    '   Tip: generate 2 takes of the important shots and keep the best.',
    ingr.length ? '3. For better character consistency, use "Ingredients to Video" instead and add the images in the ingredients folder too.' : '3. (No character ingredients in this pack.)',
    '4. Download each clip you like and name it as prompts.txt says (e.g. 03b.mp4).',
    '5. Back in History Studio: Scenes step -> Animate in Google Flow -> "Upload clips from Flow", select them all.',
    '   Each clip goes to its shot by its name, and plays instead of the still.',
    '',
    music.length ? 'MUSIC (Google Flow Music)' : '',
    music.length ? '1. For each section in music-prompts.txt, paste the brief into Flow Music and generate. Instrumental only.' : '',
    music.length ? '2. Download the track, then Look step -> Music by chapter -> Upload track on the matching row.' : '',
  ].filter((l) => l !== null).join('\r\n'));

  return { folder, frames: written.length, ingredients: ingr.length };
}

/** Is this a pack folder this app wrote? (For opening it in Explorer.) */
export const PACK_FOLDER = /^flow-pack-[a-z0-9-]{1,80}$/;

export { PUBLIC_DIR };
