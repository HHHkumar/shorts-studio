import { Player } from '@remotion/player';
import React from 'react';
import { QuizVideo } from '../remotion/QuizVideo';
import { framesToClock } from '../lib/timeline';
import type { VideoProps } from '../lib/types';
import { dimensionsFor } from '../lib/types';

export const Preview: React.FC<{ props: VideoProps | null; hasAudio: boolean }> = ({ props, hasAudio }) => {
  if (!props) {
    return (
      <div className="preview-col">
        <div className="preview-empty">
          <div style={{ fontSize: 40 }}>📱</div>
          <div>
            <b>Your video will appear here</b>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              Finish step 2 and a live preview shows up, exactly as it will be rendered.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { width, height } = dimensionsFor(props.design.orientation);

  return (
    <div className="preview-col">
      <div className="phone" style={{ aspectRatio: width + ' / ' + height }}>
        <Player
          component={QuizVideo}
          inputProps={props}
          durationInFrames={Math.max(1, props.totalDurationInFrames)}
          fps={props.fps}
          compositionWidth={width}
          compositionHeight={height}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          // The browser player pools a fixed number of <audio> tags and throws
          // once a frame needs more than it has. A busy moment can stack the
          // music bed, the narration, a scene sweep and one whoosh per option
          // all at once, which is well past the default of 5.
          numberOfSharedAudioTags={25}
          acknowledgeRemotionLicense
        />
      </div>
      <div className="preview-meta">
        <span>Live preview · {width} × {height}</span>
        <span>{framesToClock(props.totalDurationInFrames, props.fps)}</span>
      </div>
      {!hasAudio ? (
        <div className="preview-meta" style={{ color: 'var(--warn)' }}>
          <span>Silent — scene lengths are estimates until you record the voice.</span>
        </div>
      ) : null}
    </div>
  );
};
