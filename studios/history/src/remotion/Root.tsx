import React from 'react';
import { Composition } from 'remotion';
import { buildShortTimeline, buildTimeline } from '../lib/timeline';
import { demoProject } from '../lib/demo';
import { FPS, HEIGHT, WIDTH, type VideoProps } from '../lib/types';
import { HistoryVideo } from './HistoryVideo';
import { Thumbnail, THUMB_H, THUMB_W, type ThumbnailProps } from './Thumbnail';

export const COMPOSITION_ID = 'HistoryVideo';
export const SHORT_ID = 'HistoryShort';
export const THUMBNAIL_ID = 'Thumbnail';

const length = ({ props }: { props: VideoProps }) => ({ durationInFrames: Math.max(FPS, Math.round(props.totalFrames)) });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={COMPOSITION_ID}
      component={HistoryVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={300}
      defaultProps={buildTimeline(demoProject())}
      // The real length always comes from the timeline in the props.
      calculateMetadata={length}
    />
    {/* The same video, vertical, for a YouTube Short cut from a stretch of scenes. */}
    <Composition
      id={SHORT_ID}
      component={HistoryVideo}
      width={HEIGHT}
      height={WIDTH}
      fps={FPS}
      durationInFrames={300}
      defaultProps={buildShortTimeline(demoProject())}
      calculateMetadata={length}
    />
    <Composition
      id={THUMBNAIL_ID}
      component={Thumbnail}
      width={THUMB_W}
      height={THUMB_H}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{
        image: '', focus: { x: 0.5, y: 0.5 }, text: 'How Egypt beat 50°C', highlight: '50°C', accent: '#ffd23f', side: 'left', layer: null,
      } satisfies ThumbnailProps}
    />
  </>
);
