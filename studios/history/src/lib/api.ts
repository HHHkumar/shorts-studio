// Every call the browser makes to the local helper. Keys travel as headers.

import type { Credit, ElementKind, Graphic, Project, Source, VoiceSettings, Word } from './types';

export interface Keys {
  gemini: string;
  claude: string;
  eleven: string;
  pexels: string;
  pixabay: string;
}

export interface Option {
  id: string;
  label: string;
}

export interface StoryResult {
  title: string;
  titleIdeas: string[];
  styleBible: string;
  description: string;
  tags: string[];
  factNotes: string[];
  scenes: { narration?: string; imagePrompt: string; effect: string; motion: string; chapter?: string; stockQuery?: string }[];
}

export type VoiceDirections = { scenes: { index: number; narration: string; changed: boolean }[]; rejected: number };

export type StoryboardBody = {
  title: string; styleName: string; styleBible: string; kind: string;
  scenes: { index: number; beats: string[]; keepFirst: string }[];
};
export type StoryboardResult = { styleBible: string; scenes: { index: number; shots: { beat: number; imagePrompt: string; stockQuery: string }[] }[] };

export interface StockCandidate {
  id: string;
  provider: string;
  type: 'photo' | 'video';
  thumb: string;
  full: string;
  preview: string;
  width: number;
  height: number;
  duration: number;
  title: string;
  credit: Credit;
}

export interface NewsResult {
  title: string;
  titleIdeas: string[];
  scenes: { narration: string; imagePrompt: string; graphic: Graphic | null; sources: number[]; effect: string; motion: string; chapter: string; stockQuery?: string }[];
  sources: Source[];
  description: string;
  tags: string[];
  factNotes: string[];
}

export interface TrendingStory {
  headline: string;
  summary: string;
  why: string;
  category: string;
  date: string;
  heat: number;
}

export interface ElementSuggestions {
  elements: { kind: ElementKind; x: number; y: number; size: number; intensity: number; angle: number; why: string }[];
  depth: number | null;
  effect: string;
}

export interface CalloutSuggestions {
  chapters: { scene: number; title: string }[];
  callouts: { scene: number; kind: string; word: string; text: string; value: number; from: number; to: number; unit: string }[];
}

export interface Voice {
  id: string;
  name: string;
  category: string;
  description: string;
  previewUrl: string;
}

export interface ClipResult {
  src: string;
  duration: number;
  words: Word[];
  timed: boolean;
  alignError?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  scenes: number;
  pictures: number;
  voiced: number;
  cover: string;
}

export interface RenderJob {
  status: 'running' | 'done' | 'error';
  progress: number;
  stage: string;
  url: string;
  file: string;
  error: string;
  startedAt: number;
}

let keys: Keys = { gemini: '', claude: '', eleven: '', pexels: '', pixabay: '' };
export const setKeys = (k: Keys) => {
  keys = k;
};

function headers(json: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (keys.gemini.trim()) h['x-gemini-key'] = keys.gemini.trim();
  if (keys.claude.trim()) h['x-claude-key'] = keys.claude.trim();
  if (keys.eleven.trim()) h['x-eleven-key'] = keys.eleven.trim();
  if (keys.pexels.trim()) h['x-pexels-key'] = keys.pexels.trim();
  if (keys.pixabay.trim()) h['x-pixabay-key'] = keys.pixabay.trim();
  return h;
}

/**
 * Every route of this studio answers under /api/history on the one helper it
 * shares with Shorts Studio. The paths below keep their old spelling.
 */
const ROUTE = (url: string) => url.replace(/^\/api\//, '/api/history/');

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ROUTE(url), {
      method,
      headers: headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the helper. Is the black Shorts Studio window still open?');
  }
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(res.status >= 500 ? 'The helper is not running. Start the studio again.' : 'Unexpected reply from the helper.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ').');
  return data as T;
}

export const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });

export const api = {
  health: () => call<{ claudeModels: Option[]; voiceModels: Option[]; imageModels: (Option & { cents: number })[]; defaultImageModel: string }>('GET', '/api/health'),
  checkKeys: () => call<Record<'gemini' | 'claude' | 'elevenlabs' | 'pexels' | 'pixabay', string>>('POST', '/api/check-keys', {}),
  geminiModels: () => call<{ models: Option[] }>('GET', '/api/gemini/models'),
  claudeModels: () => call<{ models: Option[] }>('GET', '/api/claude/models'),

  writeStory: (body: {
    provider: string; model: string; topic: string; notes: string; minutes: number; tone: string;
    language: string; audience: string; styleName: string; voiceTags?: boolean;
  }) => call<StoryResult>('POST', '/api/story/write', body),
  directScript: (body: { provider: string; model: string; narrations: string[]; title: string; language: string; styleName: string }) =>
    call<StoryResult>('POST', '/api/story/direct', body),

  voices: () => call<{ voices: Voice[] }>('GET', '/api/voices'),
  quota: () => call<{ quota: { used: number; limit: number; tier: string } | null }>('GET', '/api/eleven/quota'),
  speak: (body: { projectId: string; sceneId: string; text: string; previous: string; next: string; settings: VoiceSettings }) =>
    call<ClipResult>('POST', '/api/voice/speak', body),
  uploadVoice: (body: { projectId: string; sceneId: string; text: string; audioBase64: string; mimeType: string }) =>
    call<ClipResult>('POST', '/api/voice/upload', body),

  drawImage: (body: { projectId: string; sceneId: string; prompt: string; model: string; referenceSrc: string; aspect?: '16:9' | '1:1' }) =>
    call<{ src: string; referenced: boolean }>('POST', '/api/image/draw', body),
  uploadImage: (body: { projectId: string; sceneId: string; fileName: string; dataBase64: string }) =>
    call<{ src: string }>('POST', '/api/image/upload', body),
  uploadMusic: (body: { projectId: string; fileName: string; dataBase64: string }) =>
    call<{ src: string; name: string }>('POST', '/api/music/upload', body),

  animate: (body: { projectId: string; shotId: string; imageSrc: string; prompt: string; model: string; seconds: number }) =>
    call<{ jobId: string }>('POST', '/api/video/animate', body),
  animateStatus: (id: string) => call<{ status: 'running' | 'done' | 'error'; stage: string; src: string; seconds: number; error: string }>('GET', '/api/video/' + id),
  videoModels: () => call<{ models: Option[] }>('GET', '/api/video/models'),
  directVoice: (body: { provider: string; model: string; narrations: string[]; tone: string; kind: string; title: string }) =>
    call<VoiceDirections>('POST', '/api/story/voice', body),
  storyboard: (body: { provider: string; model: string } & StoryboardBody) =>
    call<StoryboardResult>('POST', '/api/story/storyboard', body),
  suggestCallouts: (body: { provider: string; model: string; narrations: string[]; title: string }) =>
    call<CalloutSuggestions>('POST', '/api/story/callouts', body),
  motionPrompts: (body: { provider: string; model: string; styleName: string; shots: { label: string; narration: string; picture: string; camera: string; atmosphere: string }[] }) =>
    call<{ shots: { label: string; prompt: string }[] }>('POST', '/api/story/motion', body),
  musicBriefs: (body: { provider: string; model: string; title: string; sections: { label: string; title: string; summary: string; length: string }[] }) =>
    call<{ sections: { label: string; prompt: string }[] }>('POST', '/api/story/music', body),
  uploadClip: (body: { projectId: string; shotId: string; fileName: string; dataBase64: string }) =>
    call<{ src: string; seconds: number }>('POST', '/api/video/upload', body),
  flowPack: (body: { projectId: string; title: string; items: { label: string; image: string; prompt: string }[]; ingredients: { name: string; image: string }[]; music: { label: string; prompt: string }[] }) =>
    call<{ folder: string; frames: number; ingredients: number }>('POST', '/api/flow/pack', body),
  stockSearch: (body: { query: string; type: 'photo' | 'video'; providers: string[] }) =>
    call<{ results: StockCandidate[]; notes: string[]; query?: string }>('POST', '/api/stock/search', body),
  stockUse: (body: { projectId: string; shotId: string; candidate: StockCandidate }) =>
    call<{ src: string; type: 'photo' | 'video'; seconds: number; credit: Credit }>('POST', '/api/stock/use', body),
  newsResearch: (body: { provider: string; model: string; story: string; region: string; angle: string; asOf: string }) =>
    call<{ brief: string; sources: Source[] }>('POST', '/api/news/research', body),
  newsTrending: (body: { provider: string; model: string; categories: string[]; region: string; asOf: string }) =>
    call<{ items: TrendingStory[]; sources: Source[] }>('POST', '/api/news/trending', body),
  writeNews: (body: { provider: string; model: string; story: string; region: string; angle: string; asOf: string; minutes: number; tone: string; language: string; brief: string; sources: Source[]; voiceTags?: boolean }) =>
    call<NewsResult>('POST', '/api/story/news', body),
  suggestElements: (body: { provider: string; model: string; image: string; picture: string; narration: string }) =>
    call<ElementSuggestions>('POST', '/api/story/elements', body),
  /** The same job as one message for any chatbot, and its reply read back. */
  chatPrompt: (task: string, body: object) => call<{ prompt: string; needsPicture: boolean }>('POST', '/api/chat/prompt/' + task, body),
  chatImport: <T,>(task: string, body: object, reply: string) => call<T>('POST', '/api/chat/import/' + task, { ...body, reply }),
  thumbnailIdea: (body: { provider: string; model: string; title: string; topic: string }) =>
    call<{ text: string; highlight: string }>('POST', '/api/story/thumbnail', body),
  renderThumbnail: (body: { projectId: string; props: unknown }) => call<{ url: string; file: string }>('POST', '/api/thumbnail', body),

  projects: () => call<{ projects: ProjectSummary[] }>('GET', '/api/projects'),
  newId: () => call<{ id: string }>('POST', '/api/projects/new-id', {}),
  openProject: (id: string) => call<{ project: Project }>('GET', '/api/projects/' + id),
  saveProject: (project: Project) => call<{ updatedAt: string }>('PUT', '/api/projects/' + project.id, { project }),
  deleteProject: (id: string) => call<{ ok: boolean }>('DELETE', '/api/projects/' + id),
  tidy: (id: string) => call<{ removed: number }>('POST', '/api/projects/' + id + '/tidy', {}),

  render: (body: { projectId: string; props: unknown; quality: 'draft' | 'full'; composition?: 'HistoryVideo' | 'HistoryShort' }) => call<{ jobId: string }>('POST', '/api/render', body),
  renderStatus: (id: string) => call<RenderJob>('GET', '/api/render/' + id),
  renderJobs: () => call<{ jobs: (RenderJob & { id: string; projectId: string })[] }>('GET', '/api/render-jobs'),
  renders: () => call<{ renders: { name: string; url: string; bytes: number; at: string }[] }>('GET', '/api/renders'),
  openOutput: (folder = '') => call<{ ok: boolean }>('POST', '/api/open-output', { folder }),
};

/** Public-folder path -> URL the preview can load. */
export const mediaUrl = (src: string): string => (src ? '/' + src.replace(/^\/+/, '') : '');
