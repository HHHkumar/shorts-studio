// ---------------------------------------------------------------------------
// Gemini directs the mascot, scene by scene.
//
// For every scene that gets a doodle, the model writes four things - what the
// engineer does, how they feel, what is in the picture with them, and the
// small joke if there is one. The same shape as the mascot lab's hand-written
// test beats, which is the shape that just passed.
//
// It never describes the engineer. The character is drawn from the bible and
// the model sheet in mascot.mjs, and a scene writer that also described the
// face would be a second, drifting description of the same person.
//
// Three rules are enforced here rather than trusted to the model, as the scene
// prompt writer does:
//   - nothing before the answer scene shows or hints at the answer;
//   - no words that make an image model paint lettering;
//   - every field is held to a length an image prompt can use.
// ---------------------------------------------------------------------------

import { fetchRetrying } from './retry.mjs';
import { givesAnswerAway, stripLettering } from './thumbnail-brief.mjs';
import { answerSceneIndex } from './scene-prompts.mjs';
import { ENGINEER_POSES, energyFor, tidyDirection } from '../src/lib/doodle.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** One request, however long the explainer: the whole script is context for every scene. */
export const MAX_DIRECTED = 40;

const FIELD = { type: 'STRING' };
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    directions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scene: { type: 'INTEGER' },
          subject: { type: 'STRING', enum: ['mascot', 'illustration'] },
          pose: { type: 'STRING', enum: [...ENGINEER_POSES] },
          action: FIELD, emotion: FIELD, props: FIELD, gag: FIELD,
        },
        required: ['scene', 'subject', 'pose', 'action', 'emotion', 'props', 'gag'],
        propertyOrdering: ['scene', 'subject', 'pose', 'action', 'emotion', 'props', 'gag'],
      },
    },
  },
  required: ['directions'],
};

export const DIRECTION_SYSTEM = [
  'You direct the hand-drawn doodle pictures for a short educational video about electrical',
  'engineering - black marker on white paper, like a teacher sketching on a whiteboard. The video',
  'has a mascot: a stick-figure electrical engineer, drawn separately from a fixed model sheet -',
  'never describe what the engineer looks like, only what they do.',
  '',
  'For each scene you are asked about, first choose its subject:',
  '- "mascot": the engineer, reacting or doing something. Best for moments that need a face -',
  '  the hook, the question, the moment of doubt, the reveal, the sign-off.',
  '- "illustration": the thing itself, with no person in it - a transformer on a pole, electrons',
  '  drifting through a wire, the inside of a meter, water in pipes as a picture of current. Best',
  '  for scenes that explain, compare or describe how something works.',
  'Mix them. A video that is only the engineer is a video about the engineer; never choose the',
  'same subject for more than three scenes in a row.',
  '',
  'Then write:',
  '- action: for the mascot, what the engineer is doing, starting with a verb, e.g. "points at a',
  '  transformer on a pole". For an illustration, what the picture shows, e.g. "a step-down',
  '  transformer on a pole with thick wires in and thin wires out". Tie it to what the scene says.',
  '- emotion: for the mascot, a few words, e.g. "puzzled", "delighted, huge grin". For an',
  '  illustration, a mood such as "busy" or "calm", or an empty string.',
  '- props: anything else in the picture - concrete, drawable, few. Name only real things: a meter,',
  '  a motor, a coil of wire, a light bulb, a battery.',
  '- gag: one small visual joke that suits the scene, or "none". An illustration can have one',
  '  too - a light bulb wearing sunglasses, a tired battery with sweat drops.',
  '',
  'Rules:',
  '- Each scene is marked with an energy. calm: a relaxed pose and gag "none" or something gentle.',
  '  lively: expressive. chaotic: a big cartoon reaction is welcome.',
  '- Vary the poses. Never use the same action twice in a row.',
  '- Nothing that has to be read: no text, letters, numbers, equations, labels, signs, speech',
  '  bubbles or written sound effects. Question marks and exclamation marks are fine.',
  '- No real, named people; no logos or brands.',
  '- Scenes marked BEFORE THE ANSWER must not show or hint at which option is correct. Keep them',
  '  about the situation in the question, never its resolution.',
  '',
  'Reply with the JSON object only: {"directions": [{"scene": <number>, "subject": "mascot" or',
  '"illustration", "pose": "...", "action": "...", "emotion": "...", "props": "...", "gag": "..."}]}.',
].join('\n');

/**
 * Added when the engineer is animated: he is no longer drawn into the
 * pictures but stands beside them, moving, so the model has to know that he
 * holds nothing and that his pose comes from a fixed list.
 */
export const ANIMATED_LINES = [
  '',
  'THE ENGINEER IS ANIMATED. In "mascot" scenes he is not drawn into the picture: he stands beside it',
  'and moves. So for "mascot" scenes:',
  '- pose: the one of these that suits the moment: wave (a greeting or sign-off), point (at the thing',
  '  being talked about), idea (a realisation), think (puzzled, working it out), shock (a surprise or',
  '  alarm), cheer (the reveal, a win), teach (explaining), worried (something is wrong),',
  '  shrug (nobody knows), stand (nothing special). Vary them; never the same pose twice in a row.',
  '- props: the things drawn on the page BESIDE him - he cannot hold or touch anything. Name one or',
  '  two concrete things, or leave it an empty string when the moment is only his reaction.',
  '- gag: only something that can be drawn in those props, never on him.',
  'For "illustration" scenes, set pose to "stand"; it is not used.',
].join('\n');

/** The system prompt, with the animated engineer's rules when he is animated. */
export const directionSystem = (animated = true) => (animated ? DIRECTION_SYSTEM + '\n' + ANIMATED_LINES : DIRECTION_SYSTEM);

/**
 * The script as the model sees it: every scene for context, the ones to
 * direct marked WRITE with their energy, and any before the answer marked so.
 */
export function buildDirectionRequest(content, scenes, energy) {
  const script = Array.isArray(content && content.script) ? content.script : [];
  const answerAt = answerSceneIndex(content);
  const wanted = new Set(scenes);
  const lines = ['SUBJECT: ' + (content.subject || ''), 'TOPIC: ' + (content.topic || '')];
  if (content.question) lines.push('QUESTION: ' + content.question);
  if (Array.isArray(content.options) && content.options.length) lines.push('OPTIONS: ' + content.options.join(' | '));
  lines.push('', 'THE SCRIPT, scene by scene (direct only the scenes marked WRITE):');
  script.forEach((line, i) => {
    const said = String((line && (line.narration || line.onScreen)) || '').replace(/\s+/g, ' ').trim();
    const flags = wanted.has(i)
      ? ['WRITE', 'energy ' + energyFor(line && line.kind, energy), answerAt >= 0 && i < answerAt ? 'BEFORE THE ANSWER' : '']
        .filter(Boolean).join(', ')
      : '';
    lines.push('  scene ' + i + ' [' + (line && line.kind) + ']' + (flags ? ' (' + flags + ')' : '') + ': ' + (said || '(no narration)'));
  });
  lines.push('', 'Return directions for scenes ' + [...wanted].join(', ') + '.');
  return lines.join('\n');
}

/** What a field is allowed to say once lettering words are out. */
const scrub = (s) => stripLettering(String(s || '').replace(/[*_`#"]/g, ''));

/**
 * The directions keyed by scene index, keeping only the scenes asked for.
 *
 * A field that gives the answer away before the reveal is not fixed - it is
 * dropped, and a whole direction whose ACTION spoils is dropped, because a
 * spoiler with its noun removed is usually still a spoiler.
 */
export function normalizeDirections(raw, content, scenes) {
  const wanted = new Set(scenes);
  const answerAt = answerSceneIndex(content);
  const correct = Array.isArray(content.options) ? content.options[content.correctIndex] : undefined;
  const directions = {};
  const notes = [];

  const list = raw && Array.isArray(raw.directions) ? raw.directions : [];
  for (const item of list) {
    const scene = Number(item && item.scene);
    if (!Number.isInteger(scene) || !wanted.has(scene) || directions[scene] !== undefined) continue;
    const direction = tidyDirection({
      subject: item.subject,
      pose: item.pose,
      action: scrub(item.action),
      emotion: scrub(item.emotion),
      props: scrub(item.props),
      gag: scrub(item.gag),
    });
    if (!direction) continue;

    if (answerAt >= 0 && scene < answerAt && correct !== undefined) {
      const spoils = (text) => givesAnswerAway(text, [correct]);
      if (spoils(direction.action)) {
        notes.push('Scene ' + scene + ': the direction gave the answer away, so it was left out - write your own or try again.');
        continue;
      }
      if (spoils(direction.props)) { direction.props = ''; notes.push('Scene ' + scene + ': a prop gave the answer away and was removed.'); }
      if (spoils(direction.gag)) { direction.gag = 'none'; notes.push('Scene ' + scene + ': the gag gave the answer away and was removed.'); }
      if (spoils(direction.emotion)) direction.emotion = 'curious';
    }
    directions[scene] = direction;
  }
  return { directions, notes };
}

export async function generateDoodleDirections({ apiKey, model, content, scenes, energy, animated = true }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const script = Array.isArray(content && content.script) ? content.script : [];
  const valid = [...new Set((Array.isArray(scenes) ? scenes : []).map(Number))]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < script.length)
    .slice(0, MAX_DIRECTED);
  if (!valid.length) throw new Error('There are no scenes to direct.');

  const body = {
    systemInstruction: { parts: [{ text: directionSystem(animated) }] },
    contents: [{ role: 'user', parts: [{ text: buildDirectionRequest(content, valid, energy) }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  const res = await fetchRetrying(ENDPOINT + '/' + encodeURIComponent(model || 'gemini-2.5-flash') + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = '';
    try { detail = (JSON.parse(raw).error || {}).message || ''; } catch { detail = raw.slice(0, 200); }
    if (res.status === 400 && /API key not valid/i.test(detail)) throw new Error('That Gemini API key was rejected. Check it on the Keys step.');
    if (res.status === 429) throw new Error('Gemini rate limit hit. Wait a minute and try again.');
    throw new Error('Gemini could not direct the scenes (' + res.status + '): ' + (detail || 'unknown'));
  }

  let parsed;
  try {
    const payload = JSON.parse(raw);
    const text = ((payload.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new Error('Gemini sent directions that could not be read. Try again.');
  }
  const out = normalizeDirections(parsed, content, valid);
  const missing = valid.filter((i) => out.directions[i] === undefined);
  if (missing.length) {
    out.notes.push('No direction for scene' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ')
      + ' - write one yourself or press Direct again.');
  }
  return out;
}
