// ---------------------------------------------------------------------------
// The single data contract shared by every part of the app:
//   Gemini writes QuizContent  ->  ElevenLabs fills in audio timings
//   ->  Remotion renders VideoProps.
// If you change something here, change it in server/gemini.mjs too.
// ---------------------------------------------------------------------------

export type ThemeMode = 'dark' | 'light';
export type LayoutName = 'simple' | 'elegant' | 'nerdy' | 'flashy';
export type MusicMood = 'none' | 'calm' | 'tense' | 'upbeat' | 'custom';
export type Orientation = 'portrait' | 'landscape';

/**
 * Two quite different videos come out of this tool.
 *
 * 'mcq'       - a question, four options, a countdown and a reveal.
 * 'explainer' - a narrative that builds understanding scene by scene, with no
 *               question in it at all. Analogies and diagrams, not equations.
 */
export type VideoKind = 'mcq' | 'explainer';

export type SceneKind =
  // Shared
  | 'intro'
  | 'outro'
  | 'explain'
  // MCQ only
  | 'hook'
  | 'question'
  | 'options'
  | 'countdown'
  | 'answer'
  // Explainer only - each is a distinct on-screen layout
  | 'title'
  | 'metaphor'
  | 'diagram'
  | 'process'
  | 'versus'
  | 'timeline'
  | 'grid'
  | 'recap';

/** The explainer scene kinds, in the order they normally appear. */
export const EXPLAINER_KINDS: SceneKind[] = [
  'title', 'metaphor', 'diagram', 'process', 'versus', 'timeline', 'grid', 'recap',
];

/** One spoken word with the exact second it is said. Used for karaoke captions. */
export interface WordTiming {
  word: string;
  start: number; // seconds, relative to the start of this scene's audio
  end: number;
}

/** What Gemini invents. Pure content — no timing, no styling. */
export interface QuizContent {
  /** Missing on videos made before explainer mode existed; treat as 'mcq'. */
  videoKind?: VideoKind;
  subject: string;
  topic: string;
  difficulty: string;
  /** 1-line scroll-stopper, e.g. "99% of people get this wrong." */
  hook: string;
  /** The actual question shown on screen. Keep it short. */
  question: string;
  /** Exactly 4 answer options, without A/B/C/D prefixes. */
  options: string[];
  /** 0-based index into options. */
  correctIndex: number;
  /** One punchy sentence stating the answer. */
  answerLine: string;
  /** 2-4 short steps explaining why. Each step is one line on screen. */
  explanation: string[];
  /** A surprising related fact, used to boost the curiosity payoff. */
  funFact: string;
  /** Call to action for the last scene. */
  outro: string;
  hashtags: string[];
  /** 3-6 symbols or emoji evoking the topic, drifting in the background. */
  motifSymbols: string[];
  /** Narration written by Gemini, one entry per scene, in play order. */
  script: ScriptLine[];
}

/** The kinds of picture a scene can carry alongside its text. */
export type VisualKind = 'none' | 'formula' | 'bars' | 'compare' | 'icon' | 'sketch';

export interface VisualItem {
  label: string;
  /** Bars only: the quantity being compared. Units go in the label. */
  value?: number;
  /** A single emoji or symbol, e.g. "🌍" or "π". */
  symbol?: string;
}

/** A small diagram drawn into a scene. Written by Gemini, drawn by Remotion. */
export interface SceneVisual {
  kind: VisualKind;
  /** formula: the expression, in plain unicode, e.g. "F = m × a". */
  formula?: string;
  /** A short label under the graphic. */
  caption?: string;
  /** bars: 2-4 quantities. compare: exactly 2 things. icon: 1 thing. */
  items?: VisualItem[];
  /** sketch: which animation from the curated library to run. */
  sketch?: string;
  /** sketch: the knobs that animation reads. See src/remotion/sketches.ts. */
  params?: {
    mode?: string;
    angle?: number;
    speed?: number;
    frequency?: number;
    amplitude?: number;
    count?: number;
    ratio?: number;
    labelA?: string;
    labelB?: string;
  };
}

/** One box in a labelled diagram. */
export interface PanelNode {
  id: string;
  label: string;
  /** A single emoji or symbol drawn inside the box. */
  symbol?: string;
  /** Grid position. Left to right, top to bottom. Both default to a flow layout. */
  col?: number;
  row?: number;
  /** Marks this box as the one the narration is about. */
  accent?: boolean;
}

/** An arrow between two boxes. */
export interface PanelEdge {
  from: string;
  to: string;
  /** A word or two riding on the arrow, e.g. "flux" or "230 V". */
  label?: string;
  /** Dashed arrows read as "indirect" or "returns". */
  dashed?: boolean;
}

/** One entry in a process, timeline, grid or recap. */
export interface PanelStep {
  /** The short line that appears on screen. Also what the reveal matches on. */
  label: string;
  /** An optional second line, smaller. */
  detail?: string;
  /** A single emoji or symbol. */
  symbol?: string;
  /** Timeline only: the year or stage marker. */
  when?: string;
}

/**
 * The layout content for an explainer scene - the plan's "props".
 *
 * Deliberately one flat optional bag rather than a union: Gemini's structured
 * output does not express discriminated unions, and this matches how
 * SceneVisual already works. Each scene component reads only its own fields.
 */
export interface ScenePanel {
  /** Big text on title, section and recap cards. */
  title?: string;
  subtitle?: string;
  /** metaphor / versus: the two sides being held up against each other. */
  leftLabel?: string;
  rightLabel?: string;
  leftSymbol?: string;
  rightSymbol?: string;
  /** metaphor / versus: the short lines under each side. */
  leftPoints?: string[];
  rightPoints?: string[];
  /** diagram: the boxes and the arrows between them. */
  nodes?: PanelNode[];
  edges?: PanelEdge[];
  /** process / timeline / grid / recap: the entries, in order. */
  steps?: PanelStep[];
}

export interface ScriptLine {
  kind: SceneKind;
  /** Exactly what the voice should say. Plain words — no markdown, no LaTeX. */
  narration: string;
  /** Legacy: older saved videos carried a separate headline. No longer written. */
  onScreen?: string;
  /** Legacy: extra lines nobody narrated. No longer written. */
  bullets?: string[];
  /** Optional diagram for this beat. */
  visual?: SceneVisual;
  /** Explainer scenes only: the content of this scene's layout. */
  panel?: ScenePanel;
  /** 2-4 concrete words for finding a backdrop photo, written by Gemini. */
  imageQuery?: string;
  /** Chosen backdrop, relative to public/. Empty until the creator picks one. */
  stockSrc?: string;
  /** Who took it, shown in the copyable caption. */
  stockCredit?: string;
  /** Which candidate was chosen, so the picker can show the tick on the right one. */
  stockId?: string;
}

/** A ScriptLine after we know how long its audio actually is. */
export interface Scene extends ScriptLine {
  id: string;
  /** Path relative to public/, e.g. "generated/job123/s2.mp3". Empty = silent. */
  audioSrc: string;
  audioDuration: number; // seconds of real audio
  words: WordTiming[];
  /** Seconds added to every word timing to cancel the mp3 encoder delay. */
  captionOffset: number;
  startFrame: number;
  durationInFrames: number;
}

export interface DesignSettings {
  mode: ThemeMode;
  layout: LayoutName;
  /** Hex accent colour. Empty string = use the layout's built-in accent. */
  accent: string;
  showCaptions: boolean;
  showProgressBar: boolean;
  countdownSeconds: number;
  /** Extra silence after each narrated line, in seconds. Keeps it from feeling rushed. */
  scenePaddingSeconds: number;
  /** Cut the dead air the voice model leaves at the end of each clip. */
  trimTrailingSilence: boolean;
  /** Draw the diagrams Gemini suggested. */
  showVisuals: boolean;
  /** Drift topic symbols across the background. */
  showMotif: boolean;
  /** Draw the chosen stock photos behind each scene. */
  showStock: boolean;
  /** 0-1. How strongly the backdrop photo shows through. */
  stockOpacity: number;
  /** Which music bed to lay under the video. */
  music: MusicMood;
  /** 0-1. The bed ducks automatically underneath narration. */
  musicVolume: number;
  /** Path relative to public/ for an uploaded track. Only used when music is 'custom'. */
  customMusicSrc: string;
  /** Ticks, whooshes, the answer chime and scene sweeps. */
  sfx: boolean;
  sfxVolume: number;
  /** portrait = 1080x1920 shorts. landscape = 1920x1080 long-form explainers. */
  orientation: Orientation;
}

/**
 * Everything the Remotion composition needs. This is the render input.
 * It must be a `type` and not an `interface`: Remotion requires props to be
 * assignable to Record<string, unknown>, which only type aliases satisfy.
 */
export type VideoProps = {
  content: QuizContent;
  scenes: Scene[];
  design: DesignSettings;
  fps: number;
  totalDurationInFrames: number;
};

export const FPS = 30;

/** Portrait is the default: 9:16, the shape Shorts, Reels and TikTok use. */
export const PORTRAIT = { width: 1080, height: 1920 };
/** Landscape is 16:9, for longer explainers on YouTube proper. */
export const LANDSCAPE = { width: 1920, height: 1080 };

export const dimensionsFor = (orientation: Orientation) =>
  orientation === 'landscape' ? LANDSCAPE : PORTRAIT;
