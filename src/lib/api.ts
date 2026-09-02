import type { DesignSettings, QuizContent, ScriptLine, VideoKind, VideoProps } from './types';
import type { AudioResult } from './timeline';

export type ContentType = 'general' | 'electrical';

/** Which model writes the content. Everything else is unaffected by this. */
export type Provider = 'gemini' | 'claude';

export interface TopicForm {
  /** 'mcq' = a question with a reveal. 'explainer' = a narrated storyboard. */
  videoKind?: VideoKind;
  /** Missing on forms saved before Claude was an option; treat as 'gemini'. */
  provider?: Provider;
  /** 'general' = curiosity-led STEM. 'electrical' = exam prep for electricalmcqs.in. */
  contentType: ContentType;
  subject: string;
  topic: string;
  level: string;
  difficulty: string;
  flavour: string;
  curiosity: number;
  tone: string;
  language: string;
  targetSeconds: number;
  avoid: string;
  extra: string;
  /** The creator's own greeting, spoken first. Empty means no intro scene. */
  intro: string;
  /**
   * Filled in at generation time from the design settings. The script budget
   * depends on it: a 16:9 explainer needs several times more words than a short.
   */
  orientation?: 'portrait' | 'landscape';
  /** Which exam the questions are aimed at. Empty for general-interest videos. */
  exam?: string;
  /** How hard Gemini should push to put a diagram on every scene. */
  diagramDensity?: 'sparse' | 'balanced' | 'rich';
}

export interface VoiceSettings {
  voiceId: string;
  voiceName: string;
  modelId: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}

export interface ValidationIssue {
  severity: 'high' | 'medium' | 'low';
  where: 'question' | 'options' | 'answer' | 'explanation' | 'funFact' | 'diagram';
  problem: string;
  fix: string;
}

export interface ValidationReport {
  verdict: 'pass' | 'warn' | 'fail';
  confidence: number;
  /** DeepSeek's own answer. -1 when it would not commit to one. */
  correctIndex: number;
  /** null when DeepSeek gave no answer of its own. */
  agrees: boolean | null;
  markedIndex: number;
  reasoning: string;
  summary: string;
  issues: ValidationIssue[];
  checkedAt: string;
  /** Which question this report was about - see contentFingerprint(). */
  fingerprint?: string;
}

export interface SeoPack {
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  thumbnailText: string;
  pinnedComment: string;
  tagsLength: number;
  generatedAt: string;
  /** Which question this was written for - see contentFingerprint(). */
  fingerprint?: string;
}

export interface StockImage {
  id: string;
  provider: 'pexels' | 'nasa';
  thumb: string;
  full: string;
  credit: string;
  sourceUrl: string;
  width: number;
  height: number;
}

export interface TrendingItem {
  /** A specific, searchable topic, ready to drop into the topic box. */
  topic: string;
  /** One sentence on why it is being talked about now. */
  why: string;
  /** The counter-intuitive angle a video should be built around. */
  angle: string;
  /** 1-10, how strongly it is trending. */
  heat: number;
}

export interface TrendingResult {
  items: TrendingItem[];
  /** The pages Gemini actually consulted, so a claim can be checked. */
  sources: { title: string; uri: string }[];
  /** What it searched for. Useful when the results look off. */
  searches: string[];
}

export interface VoiceOption {
  id: string;
  name: string;
  category: string;
  description: string;
  previewUrl: string;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data as T;
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    if (res.status === 502 || res.status === 504) {
      throw new Error('The helper server is not running. Close this and run "npm start" again.');
    }
    throw new Error('The server sent back a reply we could not read (' + res.status + ').');
  }
}

export const api = {
  async health() {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Helper server not reachable.');
    return res.json() as Promise<{
      ok: boolean;
      geminiModels: { id: string; label: string }[];
      claudeModels: { id: string; label: string }[];
      voiceModels: { id: string; label: string }[];
      musicMoods: { id: string; label: string }[];
      deepseekModels: { id: string; label: string }[];
    }>;
  },

  async geminiModels(apiKey: string) {
    const res = await fetch('/api/gemini/models', { headers: { 'x-gemini-key': apiKey } });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not load the Gemini model list.');
    return data.models as { id: string; label: string }[];
  },

  async claudeModels(apiKey: string) {
    const res = await fetch('/api/claude/models', { headers: { 'x-claude-key': apiKey } });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not load the Claude model list.');
    return data.models as { id: string; label: string }[];
  },

  thumbnail(body: {
    content: QuizContent;
    design: DesignSettings;
    title: string;
    kicker: string;
    badge: string;
    figure: string;
    symbol: string;
    layout: string;
    shape: string;
  }) {
    return post<{ fileName: string; url: string; bytes: number }>('/api/thumbnail', body);
  },

  async uploadMusic(file: File) {
    const res = await fetch('/api/music', {
      method: 'POST',
      headers: { 'x-filename': file.name, 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not upload that track.');
    return data as { src: string; name: string; bytes: number };
  },

  async searchStock(pexelsKey: string, query: string, orientation: string) {
    const res = await fetch('/api/stock/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pexels-key': pexelsKey },
      body: JSON.stringify({ query, orientation, providers: ['pexels', 'nasa'] }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not search for images.');
    return data.results as StockImage[];
  },

  pickStock(url: string, id: string, jobId: string) {
    return post<{ src: string; bytes: number }>('/api/stock/pick', { url, id, jobId });
  },

  seo(
    apiKey: string,
    model: string,
    content: QuizContent,
    options: TopicForm & { channelName?: string },
  ) {
    return post<{ seo: SeoPack }>('/api/seo', { apiKey, model, content, options });
  },

  validate(apiKey: string, model: string, content: QuizContent, options: TopicForm) {
    return post<{ report: ValidationReport }>('/api/validate', { apiKey, model, content, options });
  },

  trending(apiKey: string, model: string, options: Partial<TopicForm> & { region?: string }) {
    return post<TrendingResult>('/api/trending', { apiKey, model, options });
  },

  generate(apiKey: string, model: string, options: TopicForm) {
    return post<{ content: QuizContent }>('/api/generate', { apiKey, model, options });
  },

  async voices(apiKey: string) {
    const res = await fetch('/api/voices', { headers: { 'x-el-key': apiKey } });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Could not load voices.');
    return data.voices as VoiceOption[];
  },

  startVoiceover(apiKey: string, settings: VoiceSettings, script: ScriptLine[]) {
    return post<{ jobId: string; total: number }>('/api/voiceover', { apiKey, settings, script });
  },

  async voiceoverStatus(jobId: string) {
    const res = await fetch('/api/voiceover/' + jobId);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Lost track of the voiceover job.');
    return data as {
      status: 'running' | 'done' | 'error';
      done: number;
      total: number;
      stage: string;
      tracks: Record<string, AudioResult>;
      error: string;
    };
  },

  startRender(props: VideoProps, quality: string) {
    return post<{ jobId: string }>('/api/render', { props, quality });
  },

  async renderStatus(jobId: string) {
    const res = await fetch('/api/render/' + jobId);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Lost track of the render job.');
    return data as {
      status: 'running' | 'done' | 'error';
      progress: number;
      stage: string;
      url: string;
      error: string;
    };
  },
};

export const DEFAULT_TOPIC_FORM: TopicForm = {
  videoKind: 'mcq',
  provider: 'gemini',
  contentType: 'general',
  exam: 'GATE EE',
  subject: 'Physics',
  topic: '',
  level: 'High school (age 14-18)',
  difficulty: 'Medium',
  flavour: 'Balanced',
  curiosity: 8,
  tone: 'Curious and friendly',
  language: 'English',
  targetSeconds: 45,
  avoid: '',
  extra: '',
  intro: '',
  diagramDensity: 'rich',
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceId: '',
  voiceName: '',
  modelId: 'eleven_multilingual_v2',
  stability: 0.45,
  similarity: 0.75,
  style: 0.3,
  speed: 1,
};

// Dropdown contents for the topic step.
export const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Astronomy & Space',
  'Computer Science', 'Engineering', 'Earth Science & Geology', 'Environmental Science',
  'Medicine & Human Body', 'Neuroscience', 'Statistics & Probability', 'Economics',
  'Psychology', 'History of Science', 'General Knowledge',
];

/** The syllabus areas these exams actually test, in the order they are taught. */
export const ELECTRICAL_SUBJECTS = [
  'Basic Electrical Engineering',
  'Network Theory / Circuits',
  'Electrical Machines',
  'Power Generation',
  'Power Systems',
  'Transmission & Distribution',
  'Switchgear & Protection',
  'Power Electronics & Drives',
  'Control Systems',
  'Measurements & Instrumentation',
  'Analog Electronics',
  'Digital Electronics',
  'Electromagnetic Fields',
  'Signals & Systems',
  'Electrical Materials',
  'Utilization of Electrical Energy',
  'Estimation & Costing',
  'Electrical Wiring & Safety',
  'Renewable & Non-conventional Energy',
  'Engineering Mathematics',
];

/** Exam families, each with its own question style and depth. */
export const EXAMS = [
  'GATE EE',
  'ESE / IES (Electrical)',
  'SSC JE (Electrical)',
  'RRB JE (Electrical)',
  'State AE / JE (Electrical)',
  'PSU — UPPCL / DMRC / NTPC / BHEL',
  'ITI / Wireman / Electrician trade',
  'Working professional / plant engineer',
];

export const DIAGRAM_DENSITIES = [
  { id: 'sparse', label: 'Sparse — only where it really helps' },
  { id: 'balanced', label: 'Balanced — most explanation scenes' },
  { id: 'rich', label: 'Rich — every scene that can take one (recommended)' },
];

export const LEVELS = [
  'Curious kid (age 8-12)',
  'Middle school (age 11-14)',
  'High school (age 14-18)',
  'Undergraduate',
  'Competitive exam (JEE / NEET / Olympiad)',
  'Working professional / plant engineer',
  'General adult audience',
];

export const DIFFICULTIES = ['Very easy', 'Easy', 'Medium', 'Hard', 'Brutal'];

export const FLAVOURS = [
  'Balanced',
  'Mathematical',
  'Theoretical',
  'Real-world application',
];

export const TONES = [
  'Curious and friendly',
  'Calm documentary narrator',
  'High energy hype',
  'Dry and witty',
  'Patient teacher',
];

/**
 * Identifies the exact question a validation report was about.
 *
 * Editing the question, the options or the marked answer invalidates the
 * report, and showing a stale "checked and correct" badge would be worse than
 * showing nothing at all.
 */
export function contentFingerprint(content: QuizContent): string {
  return [
    content.question,
    content.options.join('|'),
    String(content.correctIndex),
    (content.explanation || []).join('|'),
    (content.script || []).filter((s) => s.kind === 'explain').map((s) => s.narration).join('|'),
  ].join('~~');
}

/** One-click starting points for the greeting. {name} is replaced as you type. */
export const INTRO_PRESETS = [
  "Hi, it's {name} here. Ready for today's question?",
  'Welcome back to {name}.',
  "Here's your daily dose of science.",
  'Ready for today’s question?',
  'Think you know your science? Prove it.',
];

export const LANGUAGES = [
  'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Spanish', 'French',
  'German', 'Portuguese', 'Japanese', 'Arabic',
];
