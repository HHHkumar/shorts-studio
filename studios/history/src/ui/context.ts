import { createContext, useContext } from 'react';
import type { Keys, Option } from '../lib/api';
import type { Project, Scene, Shot } from '../lib/types';

export interface Prefs {
  writer: 'gemini' | 'claude';
  geminiModel: string;
  claudeModel: string;
  imageModel: string;
  videoModel: string;
}

export interface Studio {
  project: Project;
  /** Always a function of the latest project, so batch jobs never overwrite each other. */
  update: (fn: (p: Project) => Project) => void;
  updateScene: (id: string, patch: Partial<Scene> | ((s: Scene) => Partial<Scene>)) => void;
  updateShot: (shotId: string, patch: Partial<Shot> | ((s: Shot) => Partial<Shot>)) => void;
  keys: Keys;
  prefs: Prefs;
  setPrefs: (fn: (p: Prefs) => Prefs) => void;
  models: { gemini: Option[]; claude: Option[]; voice: Option[]; image: (Option & { cents: number })[]; video: Option[] };
  /** Jump the preview to a scene. */
  seekScene: (index: number) => void;
  goStep: (step: number) => void;
}

export const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const s = useContext(StudioContext);
  if (!s) throw new Error('useStudio outside a project');
  return s;
}
