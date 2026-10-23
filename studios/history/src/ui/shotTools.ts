// Drawing, uploading, cutting out and animating pictures - shared by the scene
// list and the Animate editor, so a picture being drawn shows as busy in both.

import { useCallback, useRef, useState } from 'react';
import { api, fileToBase64, mediaUrl } from '../lib/api';
import { cutOutGreen } from '../lib/chroma';
import { composeLayerPrompt, composePrompt } from '../lib/styles';
import type { Layer, Project, Scene, Shot } from '../lib/types';
import { useStudio } from './context';

export const IMAGE_TYPES = /\.(jpe?g|png|webp)$/i;

/** The picture new drawings are matched to: the chosen one, else the first that exists. */
export function styleReference(p: Project): Shot | undefined {
  const all = p.scenes.flatMap((s) => s.shots);
  return all.find((s) => s.id === p.styleRefShotId && s.image) || all.find((s) => s.image);
}

export function findShot(p: Project, shotId: string): { scene: Scene; shot: Shot; index: number } | null {
  for (const scene of p.scenes) {
    const index = scene.shots.findIndex((s) => s.id === shotId);
    if (index >= 0) return { scene, shot: scene.shots[index], index };
  }
  return null;
}

export type ShotTools = ReturnType<typeof useShotTools>;

export function useShotTools() {
  const { project, updateShot, prefs } = useStudio();
  const [busy, setBusy] = useState<Record<string, string>>({});
  const projectRef = useRef(project);
  projectRef.current = project;

  const mark = (id: string, what: string) => setBusy((b) => ({ ...b, [id]: what }));
  const clear = (id: string) => setBusy((b) => {
    const next = { ...b };
    delete next[id];
    return next;
  });

  const draw = useCallback(async (shotId: string, refSrc?: string) => {
    const p = projectRef.current;
    const found = findShot(p, shotId);
    if (!found) return;
    mark(shotId, 'Drawing…');
    try {
      const ref = refSrc !== undefined ? refSrc : (styleReference(p)?.image || '');
      const r = await api.drawImage({
        projectId: p.id,
        sceneId: shotId,
        prompt: composePrompt(p, found.shot, found.scene.narration),
        model: prefs.imageModel,
        // Never match a shot to its own old picture - that just redraws it.
        referenceSrc: ref && ref !== found.shot.image ? ref : '',
      });
      // A new picture makes an old animated clip of the old picture wrong.
      // A drawn picture is ours: any stock credit from before no longer applies.
      updateShot(shotId, { image: r.src, imageSource: 'ai', video: '', videoSeconds: 0, credit: null });
    } finally {
      clear(shotId);
    }
  }, [prefs.imageModel, updateShot]);

  const upload = useCallback(async (shotId: string, file: File) => {
    if (!IMAGE_TYPES.test(file.name)) throw new Error('Use a JPG, PNG or WebP picture.');
    mark(shotId, 'Uploading…');
    try {
      const r = await api.uploadImage({ projectId: projectRef.current.id, sceneId: shotId, fileName: file.name, dataBase64: await fileToBase64(file) });
      updateShot(shotId, { image: r.src, imageSource: 'upload', video: '', videoSeconds: 0, credit: null });
    } finally {
      clear(shotId);
    }
  }, [updateShot]);

  /** Put a cut-out into the shot's layer, keeping where it was already placed. */
  const setLayerImage = (shotId: string, image: string, prompt: string) => {
    updateShot(shotId, (s) => {
      const keep: Partial<Layer> = s.layer || {};
      return {
        layer: {
          motion: 'breathe', x: 0.3, y: 0.97, scale: 0.62, flip: false, ...keep, image, prompt,
        } as Layer,
      };
    });
  };

  const cutAndSave = async (shotId: string, url: string, prompt: string): Promise<number> => {
    const cut = await cutOutGreen(url);
    const r = await api.uploadImage({ projectId: projectRef.current.id, sceneId: shotId, fileName: 'layer.png', dataBase64: await fileToBase64(cut.png) });
    setLayerImage(shotId, r.src, prompt);
    return cut.removed;
  };

  /** Draw a character on green, cut it out, and put it on the shot's layer. Returns how much was keyed out (0..1). */
  const drawLayer = useCallback(async (shotId: string, who: string): Promise<number> => {
    const p = projectRef.current;
    mark(shotId, 'Drawing character…');
    try {
      const ref = styleReference(p)?.image || '';
      const r = await api.drawImage({
        projectId: p.id, sceneId: shotId, prompt: composeLayerPrompt(p, who), model: prefs.imageModel, referenceSrc: ref, aspect: '1:1',
      });
      mark(shotId, 'Cutting out…');
      return await cutAndSave(shotId, mediaUrl(r.src), who);
    } finally {
      clear(shotId);
    }
  }, [prefs.imageModel]);

  /** A PNG with transparency is used as it is; anything else is assumed to be on green and keyed. */
  const uploadLayer = useCallback(async (shotId: string, file: File): Promise<number> => {
    if (!IMAGE_TYPES.test(file.name)) throw new Error('Use a PNG (with transparency) or a picture on a green background.');
    mark(shotId, 'Cutting out…');
    try {
      const url = URL.createObjectURL(file);
      try {
        return await cutAndSave(shotId, url, file.name);
      } finally {
        URL.revokeObjectURL(url);
      }
    } finally {
      clear(shotId);
    }
  }, []);

  /** Turn the picture into a short clip with Veo. Resolves when the clip is saved. */
  const animate = useCallback(async (shotId: string, motionPrompt: string, seconds: number) => {
    const p = projectRef.current;
    const found = findShot(p, shotId);
    if (!found || !found.shot.image) throw new Error('Draw or upload the picture first - the clip is made from it.');
    mark(shotId, 'Animating… (1–3 min)');
    try {
      const { jobId } = await api.animate({
        projectId: p.id, shotId, imageSrc: found.shot.image, model: prefs.videoModel, seconds,
        prompt: motionPrompt + '\n\nKeep the exact art style, characters and composition of the image. No text, no captions.',
      });
      for (;;) {
        await new Promise((r) => setTimeout(r, 4000));
        const j = await api.animateStatus(jobId);
        if (j.status === 'done') {
          updateShot(shotId, { video: j.src, videoSeconds: j.seconds });
          return;
        }
        if (j.status === 'error') throw new Error(j.error);
        mark(shotId, j.stage || 'Animating…');
      }
    } finally {
      clear(shotId);
    }
  }, [prefs.videoModel, updateShot]);

  return { busy, draw, upload, drawLayer, uploadLayer, animate };
}
