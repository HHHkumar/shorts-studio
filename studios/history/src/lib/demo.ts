// A new, empty project, and a short demo one for Remotion Studio and first launch.

import { blankScene } from './script';
import { DEFAULT_DESIGN, DEFAULT_SHORT, DEFAULT_THUMBNAIL, DEFAULT_VOICE, type Project } from './types';

export function newProject(id: string): Project {
  const now = new Date().toISOString();
  return {
    id,
    kind: 'history',
    asOf: '',
    region: '',
    sources: [],
    title: '',
    topic: '',
    language: 'English',
    styleId: 'comic',
    styleBible: '',
    scenes: [],
    design: { ...DEFAULT_DESIGN },
    voice: { ...DEFAULT_VOICE },
    publish: { description: '', tags: [], titleIdeas: [], factNotes: [] },
    thumbnail: { ...DEFAULT_THUMBNAIL },
    short: { ...DEFAULT_SHORT },
    music: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function demoProject(): Project {
  const p = newProject('demo');
  p.title = 'How Ancient Egyptians Beat 50°C Heat';
  p.scenes = [
    'You wake up and the air is already trying to kill you. It is not even noon, and the sand outside is hot enough to blister skin.',
    'Yet thousands of years ago, whole cities lived through summers like this. No fans. No air conditioning. No electricity at all.',
    'Their secret started with the walls. Thick mud brick soaked up the sun all day, and only let the heat through long after dark.',
  ].map((text, i) => ({ ...blankScene(text), effect: i === 0 ? 'heat' as const : i === 2 ? 'dust' as const : 'none' as const }));
  return p;
}
