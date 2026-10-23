// ---------------------------------------------------------------------------
// The video.
//
// Scene by scene: its shots cut in on their words, each with a camera move
// towards its focus point, an optional cut-out character floating in front
// (parallax), or an AI-animated clip in place of the still. Callouts pop on
// their words. A chapter scene opens on a chapter card. Scenes arrive with
// their transition; the narration starts on each scene's first spoken frame.
//
// The same component renders the 16:9 video and the 9:16 Short. In portrait
// the picture is laid out at its full cover size and slid so its focus point
// is in frame - which is what makes the vertical crop follow the action.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  AbsoluteFill, Audio, Freeze, Img, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig,
} from 'remotion';
import type { Design, Grade, Layer, ProjectKind, TimedScene, TimedShot, VideoProps } from '../lib/types';
import { cameraAt, cameraTransform, parallax, type Camera } from './camera';
import { CalloutLayer, PICTURE_KINDS } from './Callouts';
import { Captions } from './Captions';
import { BreezeFilter, EffectLayer, Grain, HeatFilter, Vignette } from './Effects';
import { ElementLayer } from './Elements';
import { GraphicView } from './graphics/GraphicView';
import { prettyDate, TITLE_CARD_SECONDS, titleCardShown } from '../lib/timeline';
import { punchAt } from '../lib/beats';
import { PopWord } from './Pops';
import { HandFonts } from './fonts';
import { resolveSrc } from './media';
import { Soundtrack } from './Soundtrack';
import { arrival } from './Transitions';

export { resolveSrc };

const GRADE_FILTER: Record<Grade, string> = {
  none: 'none',
  warm: 'sepia(0.14) saturate(1.08)',
  sepia: 'sepia(0.62) contrast(1.05) brightness(0.97)',
  cool: 'saturate(0.85) brightness(1.02) hue-rotate(-6deg)',
  faded: 'contrast(0.86) saturate(0.78) brightness(1.06)',
};

/** Frames two shots in one scene overlap: a quick dissolve rather than a jump. */
const SHOT_BLEND = 5;

/** Where the picture sits: the whole frame in landscape, a cover-sized box slid to its focus in portrait. */
function pictureBox(width: number, height: number, portrait: boolean, fx: number) {
  if (!portrait) return { left: 0, top: 0, w: width, h: height };
  const w = (height * 16) / 9;
  return { left: -(w - width) * fx, top: 0, w, h: height };
}

const Placeholder: React.FC<{ index: number }> = ({ index }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(135deg, hsl(${(index * 47) % 360} 25% 22%), hsl(${(index * 47 + 40) % 360} 30% 12%))`,
      justifyContent: 'center', alignItems: 'center',
    }}
  >
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif', color: 'rgba(255,255,255,0.35)', fontSize: 34, textAlign: 'center', lineHeight: 1.4 }}>
      <div style={{ fontSize: 110, fontWeight: 800, color: 'rgba(255,255,255,0.18)' }}>{index + 1}</div>
      No picture yet
    </div>
  </AbsoluteFill>
);

const Clip: React.FC<{ src: string; seconds: number; sound: boolean }> = ({ src, seconds, sound }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Its own sound, if kept, sits well under the narration.
  const video = <OffthreadVideo src={resolveSrc(src)} muted={!sound} volume={sound ? 0.35 : 0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  const last = Math.max(1, Math.floor(seconds * fps) - 2);
  // Hold the final frame rather than going black if the shot outlasts the clip.
  return seconds > 0 && frame >= last ? <Freeze frame={last}>{video}</Freeze> : video;
};

/** A cut-out character, moving with the camera but further (parallax), plus its own little life. */
const LayerView: React.FC<{ layer: Layer; cam: Camera; origin: string; span: number; box: { left: number; top: number; w: number; h: number } }> = ({ layer, cam, origin, span, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const settle = 1 - Math.pow(1 - Math.min(1, frame / (fps * 1.2)), 3);
  let tx = 0;
  let ty = 0;
  let rot = 0;
  let sy = 1;
  let opacity = 1;
  switch (layer.motion) {
    case 'breathe': sy = 1 + Math.sin(t * 2.2) * 0.012; break;
    case 'bob': ty = Math.sin(t * 3.1) * 1.2; break;
    case 'sway': rot = Math.sin(t * 1.6) * 1.8; break;
    case 'slide-left': tx = (1 - settle) * 45; sy = 1 + Math.sin(t * 2.2) * 0.01; break;
    case 'slide-right': tx = -(1 - settle) * 45; sy = 1 + Math.sin(t * 2.2) * 0.01; break;
    case 'rise': ty = (1 - settle) * 30; opacity = settle; break;
    default: break;
  }
  const out = interpolate(frame, [span - 6, span], [1, 0.999], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Placed on the picture, not the screen, so it stands in the same spot in the vertical Short.
  const h = layer.scale * box.h;
  return (
    <AbsoluteFill style={{ transform: cameraTransform(cam), transformOrigin: origin, pointerEvents: 'none', opacity: opacity * out }}>
      <Img
        src={resolveSrc(layer.image)}
        style={{
          position: 'absolute',
          height: h,
          left: box.left + layer.x * box.w,
          top: box.top + layer.y * box.h,
          transform: `translate(-50%, -100%) translate(${tx}%, ${ty}%) rotate(${rot}deg) scaleY(${sy}) scaleX(${layer.flip ? -1 : 1})`,
          transformOrigin: '50% 100%',
          filter: 'drop-shadow(0 18px 18px rgba(0,0,0,0.45))',
        }}
      />
    </AbsoluteFill>
  );
};

const ShotView: React.FC<{
  scene: TimedScene; shot: TimedShot; startAt: number; span: number; design: Design; portrait: boolean; blendIn: number;
}> = ({ scene, shot, startAt, span, design, portrait, blendIn }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // A two-second shot travels less than a ten-second one, or the fast cuts would swim.
  const brief = Math.max(0.35, Math.min(1, span / (fps * 5)));
  const cam = cameraAt(shot.motion, frame, span, fps, design.motionAmount * (shot.video ? 0.3 : 1) * brief, shot.focus);
  const box = pictureBox(width, height, portrait, shot.focus.x);
  const origin = ((box.left + shot.focus.x * box.w) / width) * 100 + '% ' + ((box.top + shot.focus.y * box.h) / height) * 100 + '%';
  const heatId = 'heat-' + shot.id;
  const breezeId = 'breeze-' + shot.id;
  const heat = scene.effect === 'heat';
  const breeze = scene.effect === 'breeze';
  const warp = [heat ? `url(#${heatId})` : '', breeze ? `url(#${breezeId})` : ''].filter(Boolean).join(' ');
  // Beats: a snap zoom onto a detail, and back out on the next one.
  const punch = punchAt(scene.beats, startAt + frame, shot.from, shot.from + shot.durationInFrames, fps);
  const punchOrigin = ((box.left + punch.fx * box.w) / width) * 100 + '% ' + ((box.top + punch.fy * box.h) / height) * 100 + '%';
  const opacity = blendIn > 0 ? interpolate(frame, [0, blendIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;

  // Picture-plane callouts that appear during this shot, re-timed to it.
  const mine = scene.callouts
    .filter((c) => PICTURE_KINDS.includes(c.kind) && c.at >= shot.from && c.at < shot.from + shot.durationInFrames)
    .map((c) => ({ ...c, at: c.at - shot.from }));

  // Depth parallax: the same picture three times - all of it, then the part below
  // the horizon, then the foreground - each sliding further than the one behind.
  // Feathered masks hide the seams. Stills only; a clip has its own motion.
  const depth = shot.depth !== null && !shot.video && shot.image ? Math.max(0.15, Math.min(0.9, shot.depth)) : null;
  const bands = depth === null
    ? [{ cam, from: -1, k: 0 }]
    : [
      { cam, from: -1, k: 0 },
      { cam: parallax(cam, 1.2), from: depth, k: 1 },
      { cam: parallax(cam, 1.45), from: depth + (1 - depth) * 0.45, k: 2 },
    ];
  // Elements live on the band they stand in, so ground smoke moves with the ground.
  const bandOf = (y: number) => (depth === null ? 0 : y >= bands[2].from + 0.04 ? 2 : y >= depth + 0.04 ? 1 : 0);

  const layer = (b: (typeof bands)[number]) => {
    const mask = b.from < 0 ? undefined
      : `linear-gradient(to bottom, rgba(0,0,0,0) ${((b.from - 0.08) * 100).toFixed(1)}%, rgba(0,0,0,1) ${((b.from + 0.08) * 100).toFixed(1)}%)`;
    const filter = [b.cam.blur > 0.2 ? `blur(${b.cam.blur.toFixed(1)}px)` : '', warp].filter(Boolean).join(' ');
    return (
      <AbsoluteFill key={b.k} style={{ transform: cameraTransform(b.cam), transformOrigin: origin, filter: filter || undefined }}>
        <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.w, height: box.h, WebkitMaskImage: mask, maskImage: mask }}>
          {b.k === 0 && shot.video ? <Clip src={shot.video} seconds={shot.videoSeconds} sound={shot.videoSound} />
            : shot.image ? <Img src={resolveSrc(shot.image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Placeholder index={scene.index} />}
        </div>
        <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.w, height: box.h }}>
          <ElementLayer elements={shot.elements.filter((e) => bandOf(e.y) === b.k)} box={{ w: box.w, h: box.h }} />
          {b.k === 0 ? <CalloutLayer callouts={mine} plane="picture" end={span} portrait={portrait} /> : null}
        </div>
      </AbsoluteFill>
    );
  };

  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      {heat ? <HeatFilter id={heatId} /> : null}
      {breeze ? <BreezeFilter id={breezeId} /> : null}
      <AbsoluteFill style={punch.zoom !== 1 ? { transform: `scale(${punch.zoom})`, transformOrigin: punchOrigin } : undefined}>
        {shot.graphic ? (
          <AbsoluteFill>
            <GraphicView g={shot.graphic} theme={design.graphicTheme} />
            <div style={{ position: 'absolute', inset: 0 }}>
              <ElementLayer elements={shot.elements} box={{ w: box.w, h: box.h }} />
            </div>
          </AbsoluteFill>
        ) : bands.map(layer)}
        {shot.layer ? <LayerView layer={shot.layer} cam={parallax(cam, depth === null ? 1.7 : 2.1)} origin={origin} span={span} box={box} /> : null}
      </AbsoluteFill>
      {shot.credit ? <CreditTag text={shot.credit} portrait={portrait} /> : null}
    </AbsoluteFill>
  );
};

/** Who made the stock photo or clip: bottom-right, under the captions, opposite the source tag. */
const CreditTag: React.FC<{ text: string; portrait: boolean }> = ({ text, portrait }) => (
  <div style={{
    position: 'absolute', right: portrait ? 40 : 44, bottom: portrait ? 250 : 16, maxWidth: portrait ? '80%' : '45%',
    color: 'rgba(255,255,255,0.85)', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: portrait ? 24 : 18,
    textShadow: '0 1px 4px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right',
  }}>
    {text}
  </div>
);

const ChapterCard: React.FC<{ text: string; hold: number }> = ({ text, hold }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [kicker, title] = text.includes(':') ? [text.slice(0, text.indexOf(':')).trim(), text.slice(text.indexOf(':') + 1).trim()] : ['', text];
  const end = hold + fps * 0.4;
  const opacity = interpolate(frame, [0, 6, end - 10, end], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stamp = interpolate(frame, [2, 10], [1.35, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(10,6,2,0.55) 0%, rgba(10,6,2,0.85) 100%)' }} />
      <div style={{ textAlign: 'center', transform: `scale(${stamp})`, maxWidth: '84%' }}>
        {kicker ? (
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 44, letterSpacing: 8, textTransform: 'uppercase', color: '#e8b25e', marginBottom: 14 }}>
            {kicker}
          </div>
        ) : null}
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: 104, lineHeight: 1.05, color: '#fff4dc', textShadow: '0 6px 30px rgba(0,0,0,.8)' }}>
          {title}
        </div>
        <div style={{ height: 4, background: '#e8b25e', margin: '26px auto 0', width: interpolate(frame, [6, 20], [0, 320], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
      </div>
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ scene: TimedScene; span: number; fadeIn: number; design: Design; portrait: boolean; last: boolean; kind: ProjectKind }> = ({ scene, span, fadeIn, design, portrait, last, kind }) => {
  const frame = useCurrentFrame();
  const { style, overlay } = arrival(scene.transition, frame, fadeIn, scene.index + 1);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...style, overflow: 'hidden', backgroundColor: '#000' }}>
        {scene.shots.map((shot, i) => {
          const lastShot = i === scene.shots.length - 1;
          // A graphic has its own words: it waits for the chapter card to lift, then makes its entrance.
          const from = i === 0 && shot.graphic && scene.leadIn ? Math.max(0, scene.leadIn - 6) : shot.from;
          const dur = lastShot ? span - from : shot.from + shot.durationInFrames + SHOT_BLEND - from;
          return (
            <Sequence key={shot.id} from={from} durationInFrames={Math.max(1, dur)} name={'Shot ' + (i + 1)}>
              <ShotView scene={scene} shot={shot} startAt={from} span={Math.max(1, dur)} design={design} portrait={portrait} blendIn={i === 0 ? 0 : SHOT_BLEND} />
            </Sequence>
          );
        })}
        <EffectLayer effect={scene.effect} seed={scene.index + 1} />
        <CalloutLayer callouts={scene.callouts} plane="screen" end={last ? span : scene.durationInFrames} portrait={portrait} />
        {scene.beats.filter((b) => b.kind === 'pop').map((b) => (
          <Sequence key={'pop' + b.at} from={b.at} durationInFrames={Math.max(1, b.until - b.at)} layout="none">
            <PopWord beat={b} kind={kind} theme={design.graphicTheme} portrait={portrait} />
          </Sequence>
        ))}
        {design.showSources && scene.sourceLabel ? <SourceTag text={scene.sourceLabel} portrait={portrait} /> : null}
        {scene.chapter ? (
          <Sequence from={0} durationInFrames={scene.leadIn + 20}>
            <ChapterCard text={scene.chapter} hold={scene.leadIn} />
          </Sequence>
        ) : null}
      </AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 12, fps * 3.2, fps * 3.8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rise = interpolate(frame, [0, 18], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity, pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 25%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0) 75%)' }} />
      <div style={{ transform: `translateY(${rise}px)`, maxWidth: '80%', textAlign: 'center', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: 92, lineHeight: 1.1, color: '#fff4dc', textShadow: '0 6px 30px rgba(0,0,0,0.8)' }}>
        {title}
      </div>
    </AbsoluteFill>
  );
};

/** Short only: the question over the opening seconds. */
const Hook: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 8, fps * 4, fps * 4.6], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 230, opacity, pointerEvents: 'none' }}>
      <div style={{ maxWidth: '86%', textAlign: 'center', fontFamily: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif", fontWeight: 900, fontSize: 78, lineHeight: 1.12, color: '#fff', WebkitTextStroke: '8px #000', paintOrder: 'stroke fill', textShadow: '0 6px 20px rgba(0,0,0,.6)' }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ text: string; asOf?: string }> = ({ text, asOf }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity, background: 'rgba(8,5,2,0.72)', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ maxWidth: '84%', textAlign: 'center', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: 84, lineHeight: 1.15, color: '#fff4dc' }}>{text}</div>
      {asOf ? <div style={{ marginTop: 30, fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 40, color: 'rgba(255,244,220,0.75)' }}>As of {asOf}</div> : null}
    </AbsoluteFill>
  );
};

/** News: who reported what is on screen, small and out of the way. */
const SourceTag: React.FC<{ text: string; portrait: boolean }> = ({ text, portrait }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [6, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      // Below the captions, where nothing else lives.
      position: 'absolute', left: portrait ? 40 : 44, bottom: portrait ? 300 : 16, opacity,
      background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '6px 14px',
      fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: portrait ? 30 : 22, letterSpacing: 0.3, maxWidth: '60%',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      Source: {text}
    </div>
  );
};

/** News: the closing card that dates the reporting. */
const NewsEnd: React.FC<{ title: string; asOf: string }> = ({ title, asOf }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity, background: 'rgba(6,10,18,0.86)', justifyContent: 'center', alignItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
      <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 34, letterSpacing: 6, textTransform: 'uppercase', color: '#ffb347' }}>Reporting as of</div>
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: 96, color: '#f4efe4', marginTop: 10 }}>{asOf || 'today'}</div>
      {title ? <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 44, color: 'rgba(244,239,228,0.8)', marginTop: 30, maxWidth: '80%' }}>{title}</div> : null}
      <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 32, color: 'rgba(244,239,228,0.65)', marginTop: 40 }}>Sources are listed in the description. The story may have moved on since.</div>
    </AbsoluteFill>
  );
};

export const HistoryVideo: React.FC<VideoProps> = ({ title, scenes, design, fadeFrames, totalFrames, format, hook, endCard, music, kind, asOf }) => {
  const { fps } = useVideoConfig();
  const portrait = format === 'portrait';
  const lastScene = scenes[scenes.length - 1];
  const contentEnd = lastScene ? lastScene.startFrame + lastScene.durationInFrames : totalFrames;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <HandFonts />
      <AbsoluteFill style={{ filter: GRADE_FILTER[design.grade] || 'none' }}>
        {scenes.map((scene, i) => {
          const last = i === scenes.length - 1;
          // Stay on screen under the next scene while it arrives; the last one holds to the very end.
          const span = last ? Math.max(scene.durationInFrames, totalFrames - scene.startFrame) : scene.durationInFrames + fadeFrames;
          return (
            <Sequence key={scene.id} from={scene.startFrame} durationInFrames={span} name={'Scene ' + (i + 1)}>
              <SceneView scene={scene} span={span} fadeIn={i === 0 ? 0 : fadeFrames} design={design} portrait={portrait} last={last} kind={kind || 'history'} />
            </Sequence>
          );
        })}
        {design.grade === 'cool' ? <AbsoluteFill style={{ background: 'rgba(60,110,200,0.08)', mixBlendMode: 'soft-light' }} /> : null}
      </AbsoluteFill>

      <Vignette amount={design.vignette} />
      <Grain amount={design.grain} />

      {scenes.map((scene) => (
        <Sequence key={'v' + scene.id} from={scene.startFrame + scene.leadIn} durationInFrames={Math.max(1, scene.durationInFrames - scene.leadIn)} layout="none">
          {scene.audioSrc ? <Audio src={resolveSrc(scene.audioSrc)} /> : null}
        </Sequence>
      ))}

      {scenes.map((scene) => (
        <Sequence key={'c' + scene.id} from={scene.startFrame + scene.leadIn} durationInFrames={Math.max(1, scene.durationInFrames - scene.leadIn)}>
          <Captions words={scene.words} mode={design.captions} size={portrait ? Math.round(design.captionSize * 1.35) : design.captionSize} portrait={portrait} />
        </Sequence>
      ))}

      {titleCardShown({ title, design, format, scenes }, fps) ? (
        <Sequence from={0} durationInFrames={Math.round(fps * TITLE_CARD_SECONDS)}>
          <TitleCard title={title} />
        </Sequence>
      ) : null}

      {portrait && hook ? (
        <Sequence from={0} durationInFrames={Math.round(fps * 5)}>
          <Hook text={hook} />
        </Sequence>
      ) : null}
      {portrait && endCard && totalFrames > contentEnd ? (
        <Sequence from={contentEnd} durationInFrames={totalFrames - contentEnd}>
          <EndCard text={endCard} asOf={kind === 'news' ? prettyDate(asOf) : ''} />
        </Sequence>
      ) : null}
      {!portrait && kind === 'news' && totalFrames > contentEnd ? (
        <Sequence from={contentEnd} durationInFrames={totalFrames - contentEnd}>
          <NewsEnd title={title} asOf={prettyDate(asOf)} />
        </Sequence>
      ) : null}

      <Soundtrack scenes={scenes} design={design} total={totalFrames} music={music || []} />
    </AbsoluteFill>
  );
};
