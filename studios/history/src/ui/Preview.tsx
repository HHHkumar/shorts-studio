import React, { forwardRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { HistoryVideo } from '../remotion/HistoryVideo';
import { FPS, HEIGHT, WIDTH, type VideoProps } from '../lib/types';

/** The same component the render uses, so the preview is the export. */
export const Preview = forwardRef<PlayerRef, { props: VideoProps }>(({ props }, ref) => (
  <div className="screen">
    <Player
      ref={ref}
      component={HistoryVideo}
      inputProps={props}
      durationInFrames={Math.max(FPS, props.totalFrames)}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      controls
      style={{ width: '100%', height: '100%' }}
      acknowledgeRemotionLicense
    />
  </div>
));
Preview.displayName = 'Preview';
