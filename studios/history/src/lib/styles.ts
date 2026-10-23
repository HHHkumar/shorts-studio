// ---------------------------------------------------------------------------
// Art styles, and the one function that turns a scene into a picture prompt.
//
// The prompt is composed here, in the browser, and nowhere else. The Draw
// button sends exactly this text, and Copy puts exactly this text on the
// clipboard - so a picture made in another tool is asked for in the same
// words as one made here, and the two sit together in one video.
// ---------------------------------------------------------------------------

import { spokenText } from './speech';
import type { Project, Shot } from './types';

export interface ArtStyle {
  id: string;
  label: string;
  /** Appended to every picture prompt. */
  prompt: string;
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: 'editorial',
    label: 'Editorial news illustration',
    prompt:
      'Modern flat editorial illustration as used by quality news explainers, clean vector shapes, limited muted palette '
      + 'with one accent colour, subtle grain, simple geometric anonymous figures with no facial detail, symbolic objects '
      + 'and places, calm and neutral tone. No identifiable real people, no logos, no flags burning.',
  },
  {
    id: 'comic',
    label: 'Bold comic (like the reference video)',
    prompt:
      'Hand-drawn comic book illustration, bold clean black ink outlines, flat cel-shaded colours, '
      + 'warm saturated palette, expressive cartoon characters with simple readable faces, '
      + 'clear silhouettes, detailed but uncluttered background, soft painted sky, '
      + 'editorial explainer-video look.',
  },
  {
    id: 'ink',
    label: 'Ink cartoon (fast, witty explainers)',
    prompt:
      'Hand-drawn satirical ink cartoon, confident black pen outlines with a slight wobble, simple characters with big round heads, '
      + 'dot eyes and very expressive comic faces, slim bodies in period-accurate costume, flat muted colours (cream, ochre, brick red, '
      + 'slate blue, olive) with touches of red, warm off-white paper background with faint texture, minimal shading, '
      + 'uncluttered staging built around one clear idea or visual joke, witty YouTube history explainer look.',
  },
  {
    id: 'storybook',
    label: 'Storybook watercolour',
    prompt:
      'Gentle storybook watercolour illustration, loose ink linework, soft washes of colour, '
      + 'textured paper grain, warm light, charming simplified characters, children\'s history book feel.',
  },
  {
    id: 'engraving',
    label: 'Old engraving / woodcut',
    prompt:
      'Antique copperplate engraving, fine cross-hatched linework, sepia and ink tones on aged paper, '
      + '18th-century encyclopedia plate style, dramatic but clear composition.',
  },
  {
    id: 'painterly',
    label: 'Cinematic digital painting',
    prompt:
      'Cinematic digital matte painting, historically grounded, dramatic volumetric lighting, '
      + 'rich colour, painterly brushwork, wide establishing composition, documentary concept art.',
  },
  {
    id: 'papercut',
    label: 'Layered paper cut-out',
    prompt:
      'Layered paper cut-out diorama, crafted paper textures, soft drop shadows between layers, '
      + 'limited warm palette, playful handmade look.',
  },
  {
    id: 'doodle',
    label: 'Whiteboard doodle',
    prompt:
      'Simple black marker doodle on a clean white background with a few flat colour accents, '
      + 'stick-figure style characters with round heads, whiteboard explainer look, lots of white space.',
  },
];

export const styleFor = (id: string): ArtStyle => ART_STYLES.find((s) => s.id === id) || ART_STYLES[0];

/** Said to every image model, whatever the style: a caption burnt into the art is unfixable. */
const RULES =
  'Wide 16:9 landscape frame. No text, no letters, no captions, no speech bubbles, no watermark, no signature, no border.';

/** The full prompt for one shot. Falls back to the scene's narration when the shot has no description. */
export function composePrompt(project: Pick<Project, 'styleId' | 'styleBible'>, shot: Pick<Shot, 'imagePrompt'>, narration = ''): string {
  const subject = (shot.imagePrompt || spokenText(narration) || '').trim();
  const parts = [
    subject,
    project.styleBible.trim() ? 'Recurring cast and setting (keep consistent): ' + project.styleBible.trim() : '',
    'Style: ' + styleFor(project.styleId).prompt,
    RULES,
  ];
  return parts.filter(Boolean).join('\n\n');
}

/**
 * A character alone, for a parallax layer. Drawn on flat green so the browser
 * can cut it out - the same trick as a film studio's green screen.
 */
export function composeLayerPrompt(project: Pick<Project, 'styleId' | 'styleBible'>, who: string): string {
  return [
    (who || 'The main character').trim() + ', full body, standing, facing slightly towards the viewer.',
    project.styleBible.trim() ? 'Character reference (keep consistent): ' + project.styleBible.trim() : '',
    'Style: ' + styleFor(project.styleId).prompt,
    'The character ALONE, isolated on a perfectly flat, pure bright green (#00FF00) background filling the whole frame. '
      + 'No ground, no floor, no shadow, no scenery, no other objects. Nothing green on the character itself. '
      + 'Square frame, character centred with a small margin. No text.',
  ].filter(Boolean).join('\n\n');
}

/** Shot labels as the scene list shows them: 3, 3b, 3c. */
export const shotLabel = (sceneIndex: number, shotIndex: number): string =>
  String(sceneIndex + 1) + (shotIndex ? String.fromCharCode(97 + shotIndex) : '');

/** Every prompt, numbered to match the scene list, for pasting into another tool. */
export function allPrompts(project: Project): string {
  return project.scenes
    .flatMap((scene, i) => scene.shots.map((shot, k) => 'Scene ' + shotLabel(i, k) + '\n' + composePrompt(project, shot, scene.narration)))
    .join('\n\n---\n\n');
}
