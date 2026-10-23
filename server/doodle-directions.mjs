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
import { ENGINEER_POSES, energyFor, poseFor, tidyDirection } from '../src/lib/doodle.ts';
import { settleDirection } from '../src/lib/drawable.ts';
import { EQUIPMENT } from '../src/lib/equipment.ts';

/** The approved kinds as the model is told them: by the name a direction would use. */
export const approvedNames = (approved, kinds = EQUIPMENT) =>
  approved.map((id) => kinds.find((k) => k.id === id)).filter(Boolean).map((k) => k.words[0]);

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
  '- "illustration": an everyday picture of the idea, with no person in it - water in pipes as a',
  '  picture of current, an hourglass for time, a seesaw finding its balance, a row of light bulbs.',
  '  Best for an analogy, or for a scene that names a piece of equipment on the approved list below.',
  'Mix them. A video that is only the engineer is a video about the engineer; never choose the',
  'same subject for more than three scenes in a row.',
  '',
  'Then write:',
  '- action: for the mascot, what the engineer is doing, starting with a verb, e.g. "points at the',
  '  light bulb". For an illustration, what the picture shows, e.g. "water rushing through a narrow',
  '  pipe". Tie it to what the scene says.',
  '- emotion: for the mascot, a few words, e.g. "puzzled", "delighted, huge grin". For an',
  '  illustration, a mood such as "busy" or "calm", or an empty string.',
  '- props: anything else in the picture - concrete, drawable, few: a light bulb, a battery, a coil',
  '  of wire, a wall switch, a stopwatch.',
  '- gag: one small visual joke that suits the scene, or "none". An illustration can have one',
  '  too - a light bulb wearing sunglasses, a tired battery with sweat drops.',
  '',
  'WHAT MAY BE DRAWN. These pictures are drawn by an image model, and it cannot be trusted with',
  'anything technical: asked for a circuit it invents one. So:',
  '- Everyday objects and analogies only.',
  '- Never a circuit, a wiring connection, a diagram, a graph or a curve, a circuit symbol, field or',
  '  flux lines, arrows, a meter reading or a needle at a value, a cross-section or the inside of',
  '  anything, several panels, or more than four of anything. The video draws those itself, checked,',
  '  in other scenes - a doodle that tries to will be thrown away.',
  '- Electrical equipment only from the APPROVED DRAWINGS list in the request, named the way it is',
  '  written there, one per scene. Those are drawings a person has checked, and they are shown as',
  '  they are. Anything else - a transformer, a motor, a meter not on the list - is not drawn.',
  '- When nothing everyday fits a scene, choose "mascot" with empty props: the engineer on his own is',
  '  always right.',
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
export function buildDirectionRequest(content, scenes, energy, names = []) {
  const script = Array.isArray(content && content.script) ? content.script : [];
  const answerAt = answerSceneIndex(content);
  const wanted = new Set(scenes);
  const lines = ['SUBJECT: ' + (content.subject || ''), 'TOPIC: ' + (content.topic || '')];
  if (content.question) lines.push('QUESTION: ' + content.question);
  if (Array.isArray(content.options) && content.options.length) lines.push('OPTIONS: ' + content.options.join(' | '));
  lines.push('APPROVED DRAWINGS: ' + (names.length
    ? names.join(', ') + '. Name one of these exactly to show it; no other equipment is drawn.'
    : 'none yet - so no electrical equipment at all, only everyday things and the engineer.'));
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
 *
 * Then each direction is held to what an image model may draw
 * (src/lib/drawable.ts): a circuit, a curve, a reading or equipment nobody has
 * approved becomes the engineer explaining, and named approved equipment is
 * listed in `pictures`, to be shown as its approved drawing.
 */
export function normalizeDirections(raw, content, scenes, { approved = [], kinds = EQUIPMENT, animated = true } = {}) {
  const wanted = new Set(scenes);
  const answerAt = answerSceneIndex(content);
  const correct = Array.isArray(content.options) ? content.options[content.correctIndex] : undefined;
  const script = Array.isArray(content && content.script) ? content.script : [];
  const directions = {};
  /** scene -> the approved equipment it shows */
  const pictures = {};
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
    const kind = script[scene] && script[scene].kind;
    const settled = settleDirection(direction, { approved, kinds, animated, pose: poseFor(null, kind) });
    if (settled.note) notes.push('Scene ' + scene + ': ' + settled.note);
    if (settled.equipment) pictures[scene] = settled.equipment;
    directions[scene] = settled.direction;
  }
  return { directions, pictures, notes };
}

/**
 * `approved` and `kinds` are the equipment drawings a person has approved
 * (server/equipment.mjs): their names go to the model, and only they are shown.
 */
export async function generateDoodleDirections({ apiKey, model, content, scenes, energy, animated = true, approved = [], kinds = EQUIPMENT }) {
  if (!apiKey) throw new Error('No Gemini API key was sent. Add it on the Keys step.');
  const script = Array.isArray(content && content.script) ? content.script : [];
  const valid = [...new Set((Array.isArray(scenes) ? scenes : []).map(Number))]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < script.length)
    .slice(0, MAX_DIRECTED);
  if (!valid.length) throw new Error('There are no scenes to direct.');

  const body = {
    systemInstruction: { parts: [{ text: directionSystem(animated) }] },
    contents: [{ role: 'user', parts: [{ text: buildDirectionRequest(content, valid, energy, approvedNames(approved, kinds)) }] }],
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
  const out = normalizeDirections(parsed, content, valid, { approved, kinds, animated });
  const missing = valid.filter((i) => out.directions[i] === undefined);
  if (missing.length) {
    out.notes.push('No direction for scene' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ')
      + ' - write one yourself or press Direct again.');
  }
  return out;
}
