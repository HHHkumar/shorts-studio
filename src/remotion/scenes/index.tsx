import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { activeOption, alignOptions } from '../../lib/options-timing';
import type { Theme } from '../../lib/theme';
import { hexToRgba } from '../../lib/theme';
import type { QuizContent, Scene } from '../../lib/types';
import { ReadAlong } from '../ReadAlong';
import { autoFontSize, Pill, Stage, useEnter, useMetrics, useSceneSeconds } from '../ui';
import { Visual } from '../Visual';
import { PANEL_COMPONENTS, type PanelName } from '../Panel';
import { EffectLayer, useNarrationEffects, useSlowPush } from '../Effects';
import { activeIndex, anchorFor } from '../../lib/panel-anchor';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface SceneProps {
  theme: Theme;
  scene: Scene;
  content: QuizContent;
  /** For 'explain' scenes: which step this is, and how many there are. */
  stepIndex: number;
  stepTotal: number;
  showVisuals: boolean;
  /** Read-along text is the whole point; this only exists to turn it off. */
  showText: boolean;
  /** 0 to 1: how much the narration-driven animation may do. */
  motion: number;
}

// ---------------------------------------------------------------------------
// The answer list, shared by the options, countdown and answer beats
// ---------------------------------------------------------------------------

const OptionsBoard: React.FC<{
  theme: Theme;
  options: string[];
  correctIndex: number;
  /** 'read' lights each row as it is spoken, 'hold' is flat, 'reveal' marks the answer. */
  phase: 'read' | 'hold' | 'reveal';
  /** Seconds at which each option starts being read. Only used by 'read'. */
  starts?: number[];
  offset?: number;
  compact?: boolean;
}> = ({ theme, options, correctIndex, phase, starts, offset = 0, compact }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSeconds = useSceneSeconds();
  const m = useMetrics();
  const time = frame / fps - offset;
  const speaking = phase === 'read' && starts ? activeOption(starts, time, sceneSeconds) : -1;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(' + m.optionColumns + ', minmax(0, 1fr))',
        gap: compact ? 18 : 22,
        width: '100%',
      }}
    >
      {options.map((opt, i) => (
        <OptionRow
          key={i}
          theme={theme}
          index={i}
          text={opt}
          isCorrect={i === correctIndex}
          phase={phase}
          // All four are on screen almost immediately - a quiz viewer has to be
          // able to weigh every option. Only the highlight follows the voice.
          entryDelay={phase === 'read' ? 3 + i * 5 : 0}
          isSpeaking={speaking === i}
          revealFrame={frame}
          compact={!!compact}
        />
      ))}
    </div>
  );
};

const OptionRow: React.FC<{
  theme: Theme;
  index: number;
  text: string;
  isCorrect: boolean;
  phase: 'read' | 'hold' | 'reveal';
  entryDelay: number;
  isSpeaking: boolean;
  revealFrame: number;
  compact: boolean;
}> = ({ theme, index, text, isCorrect, phase, entryDelay, isSpeaking, revealFrame, compact }) => {
  const revealed = phase === 'reveal';
  const entry = useEnter(entryDelay, theme);

  const pop = revealed && isCorrect
    ? interpolate(revealFrame, [0, 10, 18], [1, 1.07, 1.03], { extrapolateRight: 'clamp' })
    : isSpeaking ? 1.035 : 1;
  const dim = revealed && !isCorrect
    ? interpolate(revealFrame, [0, 12], [1, 0.32], { extrapolateRight: 'clamp' })
    : 1;

  const highlighted = revealed ? isCorrect : isSpeaking;
  const bg = revealed && isCorrect
    ? hexToRgba(theme.correct, 0.2)
    : isSpeaking ? theme.accentSoft : theme.surface;
  const border = revealed && isCorrect ? theme.correct : isSpeaking ? theme.accent : theme.border;
  const m = useMetrics();
  const size = autoFontSize(text, compact ? m.optionMax - 6 : m.optionMax, compact ? m.optionMin : m.optionMin + 6);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        padding: compact ? '18px 26px' : '24px 28px',
        background: bg,
        border: theme.borderWidth + 'px solid ' + border,
        borderRadius: theme.radius,
        boxShadow: highlighted
          ? '0 0 40px ' + hexToRgba(revealed ? theme.correct : theme.accent, 0.4)
          : theme.shadow,
        opacity: (phase === 'read' ? entry : 1) * dim,
        transform:
          'translateX(' + (phase === 'read' ? (1 - entry) * -50 : 0) + 'px) scale(' + pop + ')',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          width: compact ? 56 : 64,
          height: compact ? 56 : 64,
          borderRadius: theme.layout === 'nerdy' ? 4 : 999,
          background: revealed && isCorrect ? theme.correct : theme.accentSoft,
          color: revealed && isCorrect ? theme.bg : theme.accent,
          border: '2px solid ' + (revealed && isCorrect ? theme.correct : theme.accent),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontDisplay,
          fontSize: compact ? 30 : 34,
          fontWeight: 800,
        }}
      >
        {revealed && isCorrect ? '✓' : LETTERS[index]}
      </div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: size,
          fontWeight: 600,
          color: theme.text,
          lineHeight: 1.2,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// The seven scene types. Talking scenes show the spoken words and nothing else.
// ---------------------------------------------------------------------------

/** The optional greeting the creator writes, played before anything else. */
export const IntroScene: React.FC<SceneProps> = ({ theme, scene, content, showVisuals, showText }) => {
  const m = useMetrics();
  return (
    <Stage theme={theme}>
      {showText ? (
        <ReadAlong
          theme={theme}
          words={scene.words}
          offset={scene.captionOffset}
          fallbackText={scene.narration}
          maxSize={m.headlineMax}
          minSize={m.headlineMin}
        />
      ) : null}
    </Stage>
  );
};

export const HookScene: React.FC<SceneProps> = ({ theme, scene, content, showVisuals, showText }) => {
  const p = useEnter(0, theme);
  const m = useMetrics();
  return (
    <Stage theme={theme}>
      {showText ? (
        <ReadAlong
          theme={theme}
          words={scene.words}
          offset={scene.captionOffset}
          fallbackText={scene.narration}
          maxSize={m.headlineMax}
          minSize={m.headlineMin}
        />
      ) : null}
      {/* No diagram here on purpose: anything shown before the answer is a spoiler. */}
    </Stage>
  );
};

export const QuestionScene: React.FC<SceneProps> = ({ theme, scene, content, showVisuals, showText }) => {
  const p = useEnter(0, theme);
  const m = useMetrics();
  return (
    <Stage theme={theme}>
      {showText ? (
        <ReadAlong
          theme={theme}
          words={scene.words}
          offset={scene.captionOffset}
          fallbackText={scene.narration || content.question}
          maxSize={Math.round(m.headlineMax * 0.8)}
          minSize={Math.round(m.headlineMin * 0.85)}
        />
      ) : null}
      {/* Setup only - the server strips anything that could reveal the answer. */}
      {showVisuals ? <Visual theme={theme} visual={scene.visual} /> : null}
    </Stage>
  );
};

export const OptionsScene: React.FC<SceneProps> = ({ theme, scene, content }) => {
  const sceneSeconds = useSceneSeconds();
  const starts = alignOptions(scene.words, content.options, sceneSeconds);
  return (
    <Stage theme={theme}>
      <OptionsBoard
        theme={theme}
        options={content.options}
        correctIndex={content.correctIndex}
        phase="read"
        starts={starts}
        offset={scene.captionOffset}
      />
    </Stage>
  );
};

export const CountdownScene: React.FC<SceneProps> = ({ theme, content }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const remaining = Math.max(0, Math.ceil((durationInFrames - frame) / fps));
  const secondProgress = ((durationInFrames - frame) / fps) % 1;
  const m = useMetrics();
  const ring = m.ring;
  const stroke = 14;
  const r = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const left = 1 - frame / Math.max(1, durationInFrames);

  return (
    <Stage theme={theme}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <OptionsBoard
          theme={theme}
          options={content.options}
          correctIndex={content.correctIndex}
          phase="hold"
          compact
        />
        <div style={{ position: 'relative', width: ring, height: ring, marginTop: 4 }}>
          <svg width={ring} height={ring} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke={hexToRgba(theme.text, 0.14)} strokeWidth={stroke} />
            <circle
              cx={ring / 2}
              cy={ring / 2}
              r={r}
              fill="none"
              stroke={theme.accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - left)}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.fontDisplay,
              fontSize: 116,
              fontWeight: 900,
              color: theme.accent,
              transform: 'scale(' + (1 + 0.12 * Math.max(0, secondProgress - 0.75) * 4) + ')',
              textShadow: theme.glow !== 'none' ? theme.glow : undefined,
            }}
          >
            {remaining}
          </div>
        </div>
      </div>
    </Stage>
  );
};

export const AnswerScene: React.FC<SceneProps> = ({ theme, scene, content, showText }) => (
  <Stage theme={theme}>
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 30 }}>
      <OptionsBoard
        theme={theme}
        options={content.options}
        correctIndex={content.correctIndex}
        phase="reveal"
        compact
      />
      {showText ? (
        <ReadAlong
          theme={theme}
          words={scene.words}
          offset={scene.captionOffset}
          fallbackText={scene.narration || content.answerLine}
          maxSize={62}
          minSize={40}
          color={theme.correct}
        />
      ) : null}
    </div>
  </Stage>
);

export const ExplainScene: React.FC<SceneProps> = ({
  theme,
  scene,
  stepIndex,
  stepTotal,
  showVisuals,
  showText,
}) => {
  const p = useEnter(0, theme);
  const m = useMetrics();
  return (
    <Stage theme={theme}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center' }}>
        {showText ? (
          <ReadAlong
            theme={theme}
            words={scene.words}
            offset={scene.captionOffset}
            fallbackText={scene.narration}
            maxSize={Math.round(m.headlineMax * 0.76)}
            minSize={Math.round(m.headlineMin * 0.82)}
          />
        ) : null}
        {showVisuals ? <Visual theme={theme} visual={scene.visual} /> : null}
      </div>
    </Stage>
  );
};

export const OutroScene: React.FC<SceneProps> = ({ theme, scene, content, showVisuals, showText }) => {
  const p = useEnter(4, theme);
  const m = useMetrics();
  return (
    <Stage theme={theme}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, alignItems: 'center', width: '100%' }}>
        {showText ? (
          <ReadAlong
            theme={theme}
            words={scene.words}
            offset={scene.captionOffset}
            fallbackText={scene.narration || content.outro}
            maxSize={Math.round(m.headlineMax * 0.84)}
            minSize={Math.round(m.headlineMin * 0.9)}
          />
        ) : null}
        {showVisuals ? <Visual theme={theme} visual={scene.visual} /> : null}
      </div>
    </Stage>
  );
};


// ---------------------------------------------------------------------------
// The explainer scenes
//
// These invert the priority of an MCQ beat. There, the spoken line is the whole
// picture and a diagram sits underneath it. Here the layout is the picture, and
// the narration runs along the bottom as a subtitle - because a three-minute
// explainer that puts every spoken word across the middle of the frame is just
// a wall of text with a voice over it.
//
// The words shown are still exactly the words spoken. Only the size changed.
// ---------------------------------------------------------------------------

/** The narration as a subtitle band, pinned to the bottom of the frame. */
const CaptionBand: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const m = useMetrics();
  return (
    <div
      style={{
        position: 'absolute',
        left: m.padX,
        right: m.padX,
        bottom: Math.round(m.padBottom * 0.42),
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <ReadAlong
        theme={theme}
        words={scene.words}
        offset={scene.captionOffset}
        fallbackText={scene.narration}
        maxSize={m.landscape ? 40 : 38}
        minSize={m.landscape ? 30 : 28}
      />
    </div>
  );
};

/**
 * Builds a scene component around one panel primitive. Every explainer scene is
 * the same shape - a panel filling the stage, the narration underneath - so the
 * only thing that varies is which layout gets drawn.
 *
 * Two things are added here rather than inside the panels, because they belong
 * to every layout equally and putting them in eight places would guarantee they
 * drifted apart:
 *
 *   The narration effects. Each panel animates once on entry and then holds
 *   still, which on a twenty second scene is one second of movement and
 *   nineteen of a screenshot. The verbs in the narration drive the rest: when
 *   the voice says "flows", something flows, at that moment.
 *
 *   The slow push. Four percent over the length of a scene, which nobody
 *   consciously notices and everybody feels. It is the difference between a
 *   layout that was filmed and one that was screenshotted.
 */
function explainerScene(name: PanelName): React.FC<SceneProps> {
  const Panel = PANEL_COMPONENTS[name];
  const Component: React.FC<SceneProps> = ({ theme, scene, showVisuals, showText, motion }) => {
    const { effects, time, shove, seconds, landscape } = useNarrationEffects(
      scene.words, scene.captionOffset,
    );

    // Which item the voice has reached, and therefore where on the frame the
    // effects should fire. Worked out from the same reveal order the panel
    // itself uses, so an effect lands on the box being talked about.
    const active = activeIndex(scene.panel, scene.words, time, seconds);
    const anchor = anchorFor(name, scene.panel, active, landscape);
    // The id is 's' plus the script position, which is all the push needs: a
    // number that alternates between neighbouring scenes.
    const push = useSlowPush(Number(String(scene.id).replace(/[^0-9]/g, '')) || 0);

    return (
      <Stage theme={theme}>
        {/* Under the panel, never over it. */}
        <EffectLayer theme={theme} effects={effects} time={time} anchor={anchor} strength={motion} />

        {showVisuals && scene.panel ? (
          <div
            style={{
              width: '100%',
              // The shove is what makes an impact readable; without moving the
              // content, a collision is only visible in the background.
              // Scaled too, so turning the animation down calms the shove with
              // it rather than leaving one loud thing in a quiet scene.
              transform: 'translate(' + shove.x * motion + 'px, ' + shove.y * motion + 'px)',
            }}
          >
            <div style={push}>
              <Panel
                theme={theme}
                panel={scene.panel}
                words={scene.words}
                offset={scene.captionOffset}
              />
            </div>
          </div>
        ) : null}

        {showText ? <CaptionBand scene={scene} theme={theme} /> : null}
      </Stage>
    );
  };
  Component.displayName = 'Scene_' + name;
  return Component;
}

export const TitleScene = explainerScene('title');
export const MetaphorScene = explainerScene('metaphor');
export const DiagramScene = explainerScene('diagram');
export const ProcessScene = explainerScene('process');
export const VersusScene = explainerScene('versus');
export const TimelineScene = explainerScene('timeline');
export const GridScene = explainerScene('grid');
export const MotionScene = explainerScene('motion');
export const RecapScene = explainerScene('recap');

export const SCENE_COMPONENTS: Record<Scene['kind'], React.FC<SceneProps>> = {
  intro: IntroScene,
  hook: HookScene,
  question: QuestionScene,
  options: OptionsScene,
  countdown: CountdownScene,
  answer: AnswerScene,
  explain: ExplainScene,
  outro: OutroScene,
  title: TitleScene,
  metaphor: MetaphorScene,
  diagram: DiagramScene,
  process: ProcessScene,
  versus: VersusScene,
  timeline: TimelineScene,
  grid: GridScene,
  motion: MotionScene,
  recap: RecapScene,
};
