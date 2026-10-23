// Applying a written news script to the project, and the bits of news that the
// rest of the app needs (sources for the description, today's date).

import type { NewsResult } from './api';
import { blankScene } from './script';
import type { Effect, Motion, Project } from './types';

export const NEWS_REGIONS = ['India + global', 'Global', 'India', 'United States', 'United Kingdom', 'Europe', 'Middle East', 'Asia', 'Africa', 'Latin America'];

export const todayIso = (): string => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/** A written news script becomes the project's scenes, sources and YouTube copy. */
export function applyNews(p: Project, r: NewsResult, asOf: string): Project {
  const scenes = r.scenes.map((s) => {
    const scene = blankScene(s.narration);
    return {
      ...scene,
      effect: (s.effect as Effect) || 'none',
      chapter: s.chapter || '',
      sources: s.sources,
      shots: [{ ...scene.shots[0], imagePrompt: s.imagePrompt, motion: (s.motion as Motion) || 'auto', graphic: s.graphic, stockQuery: s.stockQuery || '' }],
    };
  });
  return {
    ...p,
    kind: 'news',
    asOf,
    title: r.title || p.title,
    styleBible: '',
    sources: r.sources,
    scenes,
    publish: { description: r.description, tags: r.tags, titleIdeas: r.titleIdeas, factNotes: r.factNotes },
  };
}

/** The "Sources" block for the YouTube description. */
export function sourcesBlock(p: Project): string {
  if (!p.sources.length) return '';
  return 'Sources:\n' + p.sources.map((s) => '- ' + [s.publisher, s.title].filter(Boolean).join(': ') + (s.date ? ' (' + s.date + ')' : '') + (s.url ? '\n  ' + s.url : '')).join('\n');
}

/** "Image & video credits:" for every stock photo and clip in the video, once each. */
export function creditsBlock(p: Project): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const sc of p.scenes) {
    for (const sh of sc.shots) {
      const c = sh.credit;
      if (!c || sh.graphic) continue;
      const key = c.pageUrl || c.author + c.source;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push('- ' + c.author + ' / ' + c.source + (c.license ? ' (' + c.license + ')' : '') + (c.pageUrl ? '\n  ' + c.pageUrl : ''));
    }
  }
  return lines.length ? 'Image & video credits:\n' + lines.join('\n') : '';
}

/** Graphic shots need no picture; everything else counts as "missing" until it has one. */
export const needsPicture = (shot: { image: string; graphic?: unknown }): boolean => !shot.image && !shot.graphic;
