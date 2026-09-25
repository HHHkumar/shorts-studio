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
import { OverlayLayer } from './Overlays';
import { RevealContext } from './ReadAlong';
import { DoodlePicture, DoodleText } from './DoodleStage';
import { HandFonts } from './fonts';
import { wantsDoodle } from '../lib/doodle';

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

  // The Doodle look owns the whole frame. Drifting symbols, the animated
  // backdrop and stock photos are all ways of filling a frame that has no
  // picture of its own; every doodle scene has one, and they would only be
  // clutter around it.
  const doodle = theme.layout === 'doodle';

  return (
    <RevealContext.Provider value={design.textReveal || 'fade'}>
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {doodle ? <HandFonts /> : null}
      <Backdrop theme={theme} />

      {/* Outside every Sequence on purpose: its frame counter is the whole
          video's, so the motion runs through the cuts instead of restarting. */}
      {!doodle && design.ambient && design.ambient !== 'none' ? (
        <AmbientLayer
          theme={theme}
          content={content}
          name={design.ambient}
          intensity={design.ambientIntensity}
          width={width}
          height={height}
        />
      ) : null}

      {!doodle && design.showMotif ? <MotifLayer theme={theme} symbols={content.motifSymbols || []} /> : null}

      {scenes.map((scene, sceneIndex) => {
        const Component = SCENE_COMPONENTS[scene.kind] || SCENE_COMPONENTS.explain;
        const stepIndex = scene.kind === 'explain' ? explainScenes.indexOf(scene) : 0;
        // Checked here, not only when drawing: a scene drawn before its
        // diagram was switched on must give the frame back to the diagram.
        const doodleHere = doodle && Boolean(scene.doodleSrc) && wantsDoodle(scene, design.showVisuals);
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
            {!doodle && design.showStock && scene.stockSrc ? (
              <StockLayer theme={theme} src={scene.stockSrc} opacity={design.stockOpacity} />
            ) : null}

            {/* Outside SceneFade on purpose - see DoodleStage.tsx. */}
            {doodleHere ? <DoodlePicture theme={theme} src={scene.doodleSrc!} hold={scene.durationInFrames} /> : null}

            <SceneFade
              theme={theme}
              hold={scene.durationInFrames}
              index={sceneIndex}
              transition={design.transition || 'auto'}
              kind={scene.kind}
            >
              {(() => {
                const body = (
                  <Component
                    theme={theme}
                    scene={scene}
                    content={content}
                    stepIndex={stepIndex}
                    stepTotal={explainScenes.length}
                    showVisuals={design.showVisuals}
                    showText={design.showCaptions}
                    // Older saved videos have no setting, and full is what they
                    // were made with.
                    motion={design.motionStrength ?? 1}
                  />
                );
                return doodleHere ? <DoodleText>{body}</DoodleText> : body;
              })()}
            </SceneFade>

            {scene.audioSrc ? <Audio src={resolveSrc(scene.audioSrc)} /> : null}

          </Sequence>
        );
      })}

      <Soundtrack scenes={scenes} design={design} content={content} />

      {/* Above every scene and outside every Sequence, so grain and light
          leaks run continuously through the cuts instead of restarting. */}
      <OverlayLayer
        theme={theme}
        name={design.overlay || 'none'}
        intensity={design.overlayIntensity ?? 0.5}
      />

      {design.showProgressBar ? (
        <ProgressBar theme={theme} progress={frame / Math.max(1, durationInFrames)} />
      ) : null}
    </AbsoluteFill>
    </RevealContext.Provider>
  );
};

/** Audio paths are stored relative to public/; absolute URLs pass through. */
function resolveSrc(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return staticFile(src.replace(/^\/+/, ''));
}
