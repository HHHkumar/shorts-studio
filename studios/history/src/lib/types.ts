// ---------------------------------------------------------------------------
// The data contract shared by every layer: the wizard, the live preview and
// the render all read one Project, so what you see is what you export.
//
//   Project
//   └─ Scene          one stretch of narration (one voice clip)
//      ├─ Shot[]      pictures that cut on chosen words; the first starts the scene
//      │  └─ Layer    an optional cut-out character floating over the picture
//      └─ Callout[]   labels, arrows, dates, counters... popping in on chosen words
// ---------------------------------------------------------------------------

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** One spoken word and when it is heard, in seconds from the start of its clip. */
export interface Word {
  word: string;
  start: number;
  end: number;
}

export type VoiceSource = 'eleven' | 'mic';

export interface SceneAudio {
  /** Path relative to public/, e.g. "projects/abc/audio/s3-k2j.mp3". */
  src: string;
  duration: number;
  words: Word[];
  source: VoiceSource;
  /** True when the word timings were measured, false when they were spread evenly. */
  timed: boolean;
  /** The narration as it was when this clip was made; a later edit makes the clip stale. */
  text: string;
}

export type Motion =
  | 'auto' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'still'
  | 'push-rotate' | 'drift' | 'rack-focus' | 'shake' | 'whip';

export type Effect = 'none' | 'heat' | 'dust' | 'embers' | 'rain' | 'snow' | 'fog' | 'flicker' | 'breeze';

export type ElementKind =
  | 'smoke' | 'steam' | 'fire' | 'glow' | 'birds' | 'clouds'
  | 'sunrays' | 'shimmer' | 'ripples' | 'leaves' | 'fireflies' | 'sand';

/** A small living thing placed on the picture: smoke from a chimney, birds over the river. */
export interface AnimElement {
  id: string;
  kind: ElementKind;
  /** Where it is (smoke and steam rise from here, birds start here, rays shine from here), 0..1 on the picture. */
  x: number;
  y: number;
  /** How big, as a fraction of the picture width. */
  size: number;
  /** 0.3 subtle .. 1.5 strong. */
  intensity: number;
  /** Direction of travel in degrees for birds, sand and leaves (0 = to the right). */
  angle: number;
}

/** A point on the picture, 0..1 across and down. */
export interface Point {
  x: number;
  y: number;
}

export type LayerMotion = 'still' | 'bob' | 'breathe' | 'sway' | 'slide-left' | 'slide-right' | 'rise';

/** A cut-out character (transparent PNG) floating in front of the picture, for 2.5D depth. */
export interface Layer {
  image: string;
  prompt: string;
  motion: LayerMotion;
  /** Centre of the character's feet, 0..1. */
  x: number;
  y: number;
  /** Height as a fraction of the frame. */
  scale: number;
  flip: boolean;
}

export interface Shot {
  id: string;
  /** Index into the scene's words where this shot cuts in. The first shot always starts the scene. */
  atWord: number;
  imagePrompt: string;
  /** Path relative to public/, or '' while there is no picture yet. */
  image: string;
  imageSource?: 'ai' | 'upload';
  motion: Motion;
  /** Where the camera heads (zooms into / settles on). Also where a vertical Short crops to. */
  focus?: Point | null;
  layer?: Layer | null;
  /** An AI-animated clip made from the picture. Plays instead of it when present. */
  video?: string;
  videoSeconds?: number;
  /** Play the clip's own sound (Veo makes ambient audio) under the narration. */
  videoSound?: boolean;
  /** Marked to be animated in Google Flow (or with Veo here). */
  flow?: boolean;
  /** What moves in the clip: written for Veo / Flow's Frames to Video. */
  motionPrompt?: string;
  /** Smoke, birds, water glints... on this picture. */
  elements?: AnimElement[];
  /** Depth parallax: where the horizon is (0..1 down the picture); below it moves more than above. null = off. */
  depth?: number | null;
  /** Drawn by the video instead of a picture (news: maps, charts, quotes...). */
  graphic?: Graphic | null;
  /** Who made the stock photo or video on this shot, and its licence. */
  credit?: Credit | null;
  /** A short search for a real photo or video of this shot (places, objects, public figures). */
  stockQuery?: string;
}

/** Where a stock photo or clip came from. `required` = its licence asks for attribution (CC BY / BY-SA). */
export interface Credit {
  source: string;
  author: string;
  authorUrl: string;
  license: string;
  licenseUrl: string;
  pageUrl: string;
  required: boolean;
}

export type Transition = 'auto' | 'crossfade' | 'cut' | 'ink' | 'paper' | 'page' | 'flash' | 'whip' | 'dip';

export type CalloutKind = 'label' | 'arrow' | 'circle' | 'date' | 'counter' | 'thermometer' | 'pin' | 'route' | 'timeline';

export interface Callout {
  id: string;
  kind: CalloutKind;
  text: string;
  /** Word index it appears on. */
  atWord: number;
  /** Anchor on the picture, 0..1 (label position, circle centre, pin, arrow tip, gauge position). */
  x: number;
  y: number;
  /** Arrow tail. */
  x2?: number;
  y2?: number;
  /** Route waypoints, drawn in order. */
  points?: Point[];
  /** Counter / thermometer target; timeline "you are here" year. */
  value?: number;
  /** Counter start; timeline range. */
  from?: number;
  to?: number;
  /** Suffix for counters and gauges, e.g. "°C", " km", " years". */
  unit?: string;
}

export type GraphicKind = 'map' | 'bars' | 'line' | 'number' | 'quote' | 'people' | 'timeline' | 'versus' | 'headline';

/**
 * A data graphic drawn by the video itself, in place of a picture: news needs
 * maps, numbers and quotes, not invented photos of real people.
 * One flat shape for every kind - each kind reads the fields it needs.
 */
export interface Graphic {
  kind: GraphicKind;
  title: string;
  /** bars / line: label + value. people: label = name, note = role. timeline: label = date, note = event. */
  items: { label: string; value: number; note: string }[];
  unit: string;
  /** map: countries to highlight, by name. */
  countries: string[];
  /** quote */
  quote: string;
  who: string;
  role: string;
  /** versus */
  left: { title: string; points: string[] };
  right: { title: string; points: string[] };
  /** number: counts from `from` up to `value`. */
  value: number;
  from: number;
}

/** Where a news claim comes from. Shown on screen and listed in the description. */
export interface Source {
  title: string;
  publisher: string;
  url: string;
  /** As the publisher dates it, e.g. "2026-10-05". */
  date: string;
}

export interface Scene {
  id: string;
  narration: string;
  shots: Shot[];
  audio?: SceneAudio | null;
  effect: Effect;
  /** How this scene arrives from the one before. */
  transition: Transition;
  callouts: Callout[];
  /** A new chapter starts here: "Secret #1: The walls". Shows a chapter card and a YouTube chapter. */
  chapter: string;
  /** News: which of the project's sources back this scene (indexes into Project.sources). */
  sources?: number[];
}

export type CaptionMode = 'karaoke' | 'plain' | 'boxed' | 'off';
export type Grade = 'none' | 'warm' | 'sepia' | 'cool' | 'faded';
export type Music = 'none' | 'calm' | 'tense' | 'upbeat' | 'custom';

export interface Design {
  captions: CaptionMode;
  captionSize: number;
  /** Seconds of quiet after each scene's narration. */
  breath: number;
  /** Length of a scene transition, in seconds. */
  crossfade: number;
  /** The transition used where a scene says 'auto'. */
  transition: Exclude<Transition, 'auto'>;
  /** How far the slow camera moves travel, 0 (still) to 1 (lively). */
  motionAmount: number;
  grain: number;
  vignette: number;
  grade: Grade;
  music: Music;
  musicSrc: string;
  musicName: string;
  musicVolume: number;
  /** Music dips under the narration. */
  duck: boolean;
  /** Whooshes on transitions, pops on callouts, a hit on chapter cards. */
  sfxVolume: number;
  /** Wind, fire crackle, rain... under scenes with a matching effect. */
  ambienceVolume: number;
  titleCard: boolean;
  /** Seconds a chapter card holds before that scene's narration starts. */
  chapterHold: number;
  /** News: a small "Source: ..." tag on scenes that have sources. */
  showSources: boolean;
  /** Colours of the data graphics. */
  graphicTheme: GraphicTheme;
  /** On-screen credits for stock: only where the licence requires it, for all stock, or none. */
  credits: 'required' | 'all' | 'off';
  /** Seconds: something new on screen at least this often (punch-ins, key words). 0 = off. */
  pace: number;
  /** Which beats fill the gaps. */
  beats: BeatStyle;
}

export type GraphicTheme = 'night' | 'paper' | 'bold';

export type BeatKind = 'punch' | 'pop';
export type BeatStyle = 'mix' | 'zoom' | 'words';

export type TimedBeat = {
  kind: BeatKind;
  /** Frame in the scene. */
  at: number;
  /** Pops: the frame it has gone by. Punches hold until the next beat. */
  until: number;
  /** Pops: the word(s) on screen. */
  text: string;
  /** Punches: how far in (1 = back to the full picture), and towards which point (0-1). */
  zoom: number;
  fx: number;
  fy: number;
  /** Alternates sides and tilt, so pops do not all land in the same place. */
  n: number;
};


export interface VoiceSettings {
  mode: VoiceSource;
  voiceId: string;
  voiceName: string;
  modelId: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}

export interface Publish {
  description: string;
  tags: string[];
  titleIdeas: string[];
  /** Claims the writer flagged as debated or uncertain, to check before publishing. */
  factNotes: string[];
}

export interface ThumbnailSettings {
  /** Which picture: a shot id. '' = the first picture in the video. */
  shotId: string;
  text: string;
  /** Word(s) of the text to paint in the accent colour. */
  highlight: string;
  accent: string;
  side: 'left' | 'right';
  /** Put the cut-out character from this shot big on the other side, if it has one. */
  useLayer: boolean;
}

export interface ShortSettings {
  fromScene: number;
  toScene: number;
  hook: string;
  endCard: string;
}

/** A music track that starts at a scene (the opening, or a chapter) and plays until the next one. */
export interface MusicCue {
  sceneId: string;
  /** The brief for Flow Music (or any music tool). */
  prompt: string;
  src: string;
  name: string;
}

export type ProjectKind = 'history' | 'news';

export interface Project {
  /** A history explainer, or a news explainer (live-researched, sourced, dated). */
  kind: ProjectKind;
  /** News: the day the reporting is "as of", ISO date. */
  asOf: string;
  /** News: the region the story is told for. */
  region: string;
  sources: Source[];
  id: string;
  title: string;
  topic: string;
  language: string;
  /** Art style preset id, see styles.ts. */
  styleId: string;
  /** Recurring characters, setting and palette, appended to every picture prompt. */
  styleBible: string;
  /** The shot whose picture every new picture is matched to. Defaults to the first drawn one. */
  styleRefShotId?: string;
  scenes: Scene[];
  design: Design;
  voice: VoiceSettings;
  publish: Publish;
  thumbnail: ThumbnailSettings;
  short: ShortSettings;
  /** Per-chapter music. Where a stretch has no track, the Look step's music plays. */
  music: MusicCue[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// What the composition is given. Built from a Project by timeline.ts.
// Frames in Timed* are relative to the start of their scene.
// ---------------------------------------------------------------------------

export type TimedShot = {
  id: string;
  image: string;
  video: string;
  videoSeconds: number;
  videoSound: boolean;
  motion: Exclude<Motion, 'auto'>;
  focus: Point;
  layer: Layer | null;
  elements: AnimElement[];
  depth: number | null;
  graphic: Graphic | null;
  /** "Photo: Diego Delso / Wikimedia Commons, CC BY-SA 4.0", or '' when none is shown. */
  credit: string;
  from: number;
  durationInFrames: number;
};

/** `at` is the frame (in its scene) it appears on. Not `from`: counters and timelines use that for a number. */
export type TimedCallout = Callout & { at: number; until: number };

export type TimedScene = {
  id: string;
  index: number;
  narration: string;
  audioSrc: string;
  /** Word times are relative to the clip, which starts `leadIn` frames into the scene. */
  words: Word[];
  effect: Effect;
  transition: Exclude<Transition, 'auto'>;
  chapter: string;
  leadIn: number;
  /** Frames of narration, starting at leadIn. Music ducks under this. */
  voiceFrames: number;
  /** News: "Reuters · The Hindu" for this scene's source tag, or ''. */
  sourceLabel: string;
  shots: TimedShot[];
  callouts: TimedCallout[];
  /** Punch-ins and key words between the cuts, so nothing holds too long. */
  beats: TimedBeat[];
  startFrame: number;
  /** Frames this scene owns. Its picture lingers `fadeFrames` longer, under the next one. */
  durationInFrames: number;
};

// Types rather than interfaces: Remotion wants props assignable to
// Record<string, unknown>, and only type aliases are.
export type VideoProps = {
  title: string;
  scenes: TimedScene[];
  design: Design;
  fadeFrames: number;
  totalFrames: number;
  format: 'landscape' | 'portrait';
  /** Short only: the line over the opening, and the closing card. */
  hook: string;
  endCard: string;
  /** The music, as consecutive stretches; each loops and crossfades into the next. */
  music: MusicSegment[];
  kind: ProjectKind;
  /** News: closes on a dated card ("Reporting as of 6 Oct 2026"). '' for history. */
  asOf: string;
};

export type MusicSegment = { src: string; from: number; to: number };

export const DEFAULT_DESIGN: Design = {
  captions: 'karaoke',
  captionSize: 54,
  breath: 0.35,
  crossfade: 0.6,
  transition: 'crossfade',
  motionAmount: 0.6,
  grain: 0.35,
  vignette: 0.45,
  grade: 'warm',
  music: 'calm',
  musicSrc: '',
  musicName: '',
  musicVolume: 0.14,
  duck: true,
  sfxVolume: 0.5,
  ambienceVolume: 0.2,
  titleCard: false,
  chapterHold: 1.6,
  showSources: true,
  graphicTheme: 'night',
  credits: 'required',
  pace: 3,
  beats: 'mix',
};

export const DEFAULT_VOICE: VoiceSettings = {
  mode: 'eleven',
  voiceId: '',
  voiceName: '',
  modelId: 'eleven_v4',
  stability: 0.45,
  similarity: 0.75,
  style: 0.3,
  speed: 1,
};

export const DEFAULT_THUMBNAIL: ThumbnailSettings = {
  shotId: '', text: '', highlight: '', accent: '#ffd23f', side: 'left', useLayer: true,
};

export const DEFAULT_SHORT: ShortSettings = { fromScene: 0, toScene: 4, hook: '', endCard: 'Full story on the channel ▶' };

export const EFFECTS: { id: Effect; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'heat', label: 'Heat haze' },
  { id: 'dust', label: 'Floating dust' },
  { id: 'embers', label: 'Embers / sparks' },
  { id: 'rain', label: 'Rain' },
  { id: 'snow', label: 'Snow' },
  { id: 'fog', label: 'Drifting fog / smoke' },
  { id: 'flicker', label: 'Fire / candle flicker' },
  { id: 'breeze', label: 'Breeze (plants & cloth sway)' },
];

export const MOTIONS: { id: Motion; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'zoom-in', label: 'Slow zoom in' },
  { id: 'zoom-out', label: 'Slow zoom out' },
  { id: 'pan-left', label: 'Pan left' },
  { id: 'pan-right', label: 'Pan right' },
  { id: 'pan-up', label: 'Tilt up' },
  { id: 'push-rotate', label: 'Push in + turn' },
  { id: 'drift', label: 'Handheld drift' },
  { id: 'rack-focus', label: 'Rack focus (blur → sharp)' },
  { id: 'shake', label: 'Shake (impact)' },
  { id: 'whip', label: 'Whip in' },
  { id: 'still', label: 'Still' },
];

export const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: 'auto', label: 'Default' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'cut', label: 'Hard cut' },
  { id: 'ink', label: 'Ink blot' },
  { id: 'paper', label: 'Paper tear' },
  { id: 'page', label: 'Page slide' },
  { id: 'flash', label: 'Flash' },
  { id: 'whip', label: 'Whip pan' },
  { id: 'dip', label: 'Dip to black' },
];

export const GRAPHIC_KINDS: { id: GraphicKind; label: string; hint: string }[] = [
  { id: 'map', label: 'Map', hint: 'Highlights countries on a world map' },
  { id: 'bars', label: 'Bar chart', hint: 'Compare amounts: label + value per bar' },
  { id: 'line', label: 'Line chart', hint: 'A trend over time: label (year/month) + value' },
  { id: 'number', label: 'Big number', hint: 'One striking number that counts up' },
  { id: 'quote', label: 'Quote', hint: 'What someone said, with who and their role' },
  { id: 'people', label: 'Who’s who', hint: 'Up to 4 key people or groups: name + role' },
  { id: 'timeline', label: 'Timeline', hint: 'Events in order: date + what happened' },
  { id: 'versus', label: 'Two sides', hint: 'Each side’s position, side by side' },
  { id: 'headline', label: 'Headline', hint: 'A news-style headline card' },
];

export function blankGraphic(kind: GraphicKind = 'headline'): Graphic {
  return {
    kind, title: '', items: [], unit: '', countries: [], quote: '', who: '', role: '',
    left: { title: '', points: [] }, right: { title: '', points: [] }, value: 0, from: 0,
  };
}

export const ELEMENT_KINDS: { id: ElementKind; label: string; hint: string; size: number; angle: number }[] = [
  { id: 'smoke', label: 'Smoke', hint: 'Rises from the point: chimneys, forges, incense', size: 0.12, angle: 0 },
  { id: 'steam', label: 'Steam', hint: 'Light and quick: cooking pots, hot baths, hot stone', size: 0.06, angle: 0 },
  { id: 'fire', label: 'Fire / torch', hint: 'A flickering flame with glow and sparks', size: 0.05, angle: 0 },
  { id: 'glow', label: 'Lamp glow', hint: 'Warm flickering light: oil lamps, candles, windows at night', size: 0.18, angle: 0 },
  { id: 'birds', label: 'Birds', hint: 'A small flock flying across the sky', size: 0.18, angle: 0 },
  { id: 'clouds', label: 'Clouds', hint: 'Soft clouds drifting slowly across', size: 0.5, angle: 0 },
  { id: 'sunrays', label: 'Sun rays', hint: 'Light beams from the sun or a window', size: 0.6, angle: 0 },
  { id: 'shimmer', label: 'Water glints', hint: 'Sparkles on a river, pool or sea', size: 0.35, angle: 0 },
  { id: 'ripples', label: 'Ripples', hint: 'Rings spreading on water', size: 0.12, angle: 0 },
  { id: 'leaves', label: 'Falling leaves', hint: 'Leaves or petals drifting down from the point', size: 0.3, angle: 0 },
  { id: 'fireflies', label: 'Fireflies / sparkles', hint: 'Glowing specks wandering around the point', size: 0.2, angle: 0 },
  { id: 'sand', label: 'Blowing sand', hint: 'Wind-blown streaks along the ground', size: 0.6, angle: 0 },
];

export const LAYER_MOTIONS: { id: LayerMotion; label: string }[] = [
  { id: 'breathe', label: 'Breathe' },
  { id: 'bob', label: 'Bob' },
  { id: 'sway', label: 'Sway' },
  { id: 'slide-left', label: 'Walk in from right' },
  { id: 'slide-right', label: 'Walk in from left' },
  { id: 'rise', label: 'Rise up' },
  { id: 'still', label: 'Still' },
];

export const CALLOUT_KINDS: { id: CalloutKind; label: string; hint: string }[] = [
  { id: 'label', label: 'Label', hint: 'A hand-written note, e.g. "wind catcher"' },
  { id: 'arrow', label: 'Arrow + label', hint: 'Points at something. Click the tip, then Shift+click the tail.' },
  { id: 'circle', label: 'Circle', hint: 'A hand-drawn ring around something' },
  { id: 'date', label: 'Date stamp', hint: 'e.g. "Egypt, 1500 BC"' },
  { id: 'counter', label: 'Counter', hint: 'Counts up to a number: 2,300,000 blocks' },
  { id: 'thermometer', label: 'Thermometer', hint: 'Rises to a temperature' },
  { id: 'pin', label: 'Map pin', hint: 'Drops a pin with a name' },
  { id: 'route', label: 'Map route', hint: 'Draws a path. Click to add waypoints.' },
  { id: 'timeline', label: 'Timeline', hint: 'Where this sits in history: a bar from year to year' },
];
