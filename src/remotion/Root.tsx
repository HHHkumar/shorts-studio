import React from 'react';
import { Composition } from 'remotion';
import { makeDemoProps } from '../lib/demo';
import { DEFAULT_DESIGN } from '../lib/theme';
import { dimensionsFor, FPS, PORTRAIT } from '../lib/types';
import type { VideoProps } from '../lib/types';
import { QuizVideo } from './QuizVideo';
import { Thumbnail, THUMBNAIL_ID, thumbSizeFor, type ThumbnailProps } from './Thumbnail';
import { CarouselSlide, CAROUSEL_FRAMES, CAROUSEL_ID } from './Carousel';
import { planCarousel, SLIDE_SIZE } from '../lib/carousel';

export const COMPOSITION_ID = 'QuizVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
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

    {/* A still, at YouTube's thumbnail size. Same theme as the video it
        belongs to, so the two read as one piece of work. */}
    <Composition
      id={THUMBNAIL_ID}
      component={Thumbnail}
      width={thumbSizeFor('landscape').width}
      height={thumbSizeFor('landscape').height}
      fps={FPS}
      durationInFrames={1}
      // The shape is a prop, so one composition covers the YouTube cover image
      // and the portrait one a Short shows.
      calculateMetadata={({ props }: { props: ThumbnailProps }) => thumbSizeFor(props.shape)}
      defaultProps={{
        content: makeDemoProps().content,
        design: DEFAULT_DESIGN,
        title: 'Which one hits the ground *first*?',
        kicker: 'Physics',
        badge: '',
        figure: '',
        symbol: '🌙',
        layout: 'question' as const,
        shape: 'landscape' as const,
      }}
    />
    {/* One square slide of the carousel post; the server renders each slide in turn. */}
    <Composition
      id={CAROUSEL_ID}
      component={CarouselSlide}
      width={SLIDE_SIZE}
      height={SLIDE_SIZE}
      fps={FPS}
      durationInFrames={CAROUSEL_FRAMES}
      defaultProps={{
        content: makeDemoProps().content,
        design: DEFAULT_DESIGN,
        slide: planCarousel(makeDemoProps().content).slides[0],
        index: 0,
        total: planCarousel(makeDemoProps().content).slides.length,
        channelName: '',
      }}
    />
    </>
  );
};
