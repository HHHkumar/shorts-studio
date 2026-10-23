// Callout defaults, and turning the writer's suggestions into callouts.

import type { CalloutSuggestions } from './api';
import { findWord, newCalloutId } from './script';
import type { Callout, CalloutKind, Project } from './types';

/** Where each kind sits until she moves it: clear of the captions, which own the bottom of the frame. */
export function defaultCallout(kind: CalloutKind, atWord = 0, patch: Partial<Callout> = {}): Callout {
  const base: Callout = { id: newCalloutId(), kind, text: '', atWord, x: 0.5, y: 0.3 };
  switch (kind) {
    case 'label': return { ...base, x: 0.5, y: 0.22, ...patch };
    case 'arrow': return { ...base, x: 0.56, y: 0.5, x2: 0.36, y2: 0.26, ...patch };
    case 'circle': return { ...base, x: 0.5, y: 0.48, ...patch };
    case 'date': return { ...base, x: 0.18, y: 0.2, ...patch };
    case 'counter': return { ...base, x: 0.76, y: 0.2, from: 0, value: 100, unit: '', ...patch };
    case 'thermometer': return { ...base, x: 0.84, y: 0.44, from: 20, value: 50, unit: '°C', ...patch };
    case 'pin': return { ...base, x: 0.5, y: 0.5, ...patch };
    case 'route': return { ...base, x: 0.3, y: 0.62, points: [{ x: 0.28, y: 0.62 }, { x: 0.47, y: 0.46 }, { x: 0.68, y: 0.36 }], ...patch };
    case 'timeline': return { ...base, x: 0.5, y: 0.01, from: -3000, to: 2000, value: -1500, ...patch };
    default: return { ...base, ...patch };
  }
}

const KINDS: CalloutKind[] = ['label', 'arrow', 'circle', 'date', 'counter', 'thermometer', 'pin', 'route', 'timeline'];

/** Apply the writer's suggestions: chapter titles, and callouts on the words they name. Existing callouts are kept. */
export function applySuggestions(p: Project, s: CalloutSuggestions): Project {
  const scenes = p.scenes.map((scene, i) => {
    const chapter = s.chapters.find((c) => c.scene === i + 1);
    const added: Callout[] = s.callouts
      .filter((c) => c.scene === i + 1 && KINDS.includes(c.kind as CalloutKind))
      .map((c) => {
        const at = findWord(scene.narration, c.word);
        const kind = c.kind as CalloutKind;
        const numbers: Partial<Callout> = {};
        if (kind === 'counter' || kind === 'thermometer') Object.assign(numbers, { value: c.value, from: c.from, unit: c.unit || (kind === 'thermometer' ? '°C' : '') });
        if (kind === 'timeline') Object.assign(numbers, { value: c.value, from: c.from, to: c.to });
        return defaultCallout(kind, Math.max(0, at), { text: c.text, ...numbers });
      });
    return {
      ...scene,
      chapter: scene.chapter || (chapter ? chapter.title : ''),
      callouts: [...scene.callouts, ...added],
    };
  });
  return { ...p, scenes };
}
