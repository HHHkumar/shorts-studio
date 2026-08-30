import React from 'react';
import { Composition } from 'remotion';
import { makeDemoProps } from '../lib/demo';
import { dimensionsFor, FPS, PORTRAIT } from '../lib/types';
import type { VideoProps } from '../lib/types';
import { QuizVideo } from './QuizVideo';

export const COMPOSITION_ID = 'QuizVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={QuizVideo}
      width={PORTRAIT.width}
      height={PORTRAIT.height}
      fps={FPS}
      durationInFrames={600}
      defaultProps={makeDemoProps()}
      // The real length always comes from the generated timeline.
      // Both the size and the length of the video come from the props, so one
      // composition covers portrait shorts and landscape explainers alike.
      calculateMetadata={({ props }: { props: VideoProps }) => {
        const { width, height } = dimensionsFor(props.design.orientation);
        return {
          durationInFrames: Math.max(30, Math.round(props.totalDurationInFrames)),
          fps: props.fps || FPS,
          width,
          height,
        };
      }}
    />
  );
};
