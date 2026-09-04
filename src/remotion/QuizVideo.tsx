import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { getTheme } from '../lib/theme';
import type { VideoProps } from '../lib/types';
import { SCENE_COMPONENTS } from './scenes';
import { Backdrop, ProgressBar, SCENE_OVERLAP, SceneFade } from './ui';
import { MotifLayer } from './Visual';
import { AmbientLayer } from './AmbientLayer';
import { Soundtrack } from './Soundtrack';
import { StockLayer } from './StockLayer';

/**
 * The whole video. Every scene is a <Sequence> that starts at the exact frame
 * its narration starts, and that scene's audio lives inside the same Sequence -
 * which is why picture and sound can never drift apart.
 */
export const QuizVideo: React.FC<VideoProps> = ({ content, scenes, design }) => {
  const theme = getTheme(design);
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const explainScenes = scenes.filter((s) => s.kind === 'explain');

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Backdrop theme={theme} />

      {/* Outside every Sequence on purpose: its frame counter is the whole
          video's, so the motion runs through the cuts instead of restarting. */}
      {design.ambient && design.ambient !== 'none' ? (
        <AmbientLayer
          theme={theme}
          content={content}
          name={design.ambient}
          intensity={design.ambientIntensity}
          width={width}
          height={height}
        />
      ) : null}

      {design.showMotif ? <MotifLayer theme={theme} symbols={content.motifSymbols || []} /> : null}

      {scenes.map((scene, sceneIndex) => {
        const Component = SCENE_COMPONENTS[scene.kind] || SCENE_COMPONENTS.explain;
        const stepIndex = scene.kind === 'explain' ? explainScenes.indexOf(scene) : 0;
        return (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            // Held open past its narration so it can cross-fade with the next
            // scene. The audio inside is unaffected: it plays its file and
            // stops, whatever the Sequence does.
            durationInFrames={scene.durationInFrames + SCENE_OVERLAP}
            name={scene.kind + ' - ' + scene.narration.slice(0, 28)}
          >
            {design.showStock && scene.stockSrc ? (
              <StockLayer theme={theme} src={scene.stockSrc} opacity={design.stockOpacity} />
            ) : null}

            <SceneFade theme={theme} hold={scene.durationInFrames} index={sceneIndex}>
              <Component
                theme={theme}
                scene={scene}
                content={content}
                stepIndex={stepIndex}
                stepTotal={explainScenes.length}
                showVisuals={design.showVisuals}
                showText={design.showCaptions}
              />
            </SceneFade>

            {scene.audioSrc ? <Audio src={resolveSrc(scene.audioSrc)} /> : null}

          </Sequence>
        );
      })}

      <Soundtrack scenes={scenes} design={design} content={content} />

      {design.showProgressBar ? (
        <ProgressBar theme={theme} progress={frame / Math.max(1, durationInFrames)} />
      ) : null}
    </AbsoluteFill>
  );
};

/** Audio paths are stored relative to public/; absolute URLs pass through. */
function resolveSrc(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return staticFile(src.replace(/^\/+/, ''));
}
