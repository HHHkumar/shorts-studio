// ---------------------------------------------------------------------------
// One video, start to finish, with nobody pressing the buttons: the batch
// runner's engine. The same calls the steps make, in the same order, so a
// video made overnight is made exactly as one made by hand.
//
//   write -> check -> picture check -> formula card -> engineer -> drawings -> voice -> render
//
// It stops short, and leaves the video in the library to look at, whenever a
// check fails: DeepSeek disagreeing with the answer is the one thing no
// batch should publish past. Every step's cost goes to this video's own
// ledger, not to whatever is open in the editor.
// ---------------------------------------------------------------------------

import { api, divertSpending, type Spend, type TopicForm, type VoiceSettings } from './api';
import type { DesignSettings, QuizContent } from './types';
import { FPS } from './types';
import { buildScenes, type AudioResult } from './timeline';
import { tidySheet } from './formula-card';
import { withFormulaScene, withWorking } from './script-edit';
import { doodleScenes, needsDrawing, tidyDirection } from './doodle';
import { recordVoice } from './voice-run';
import { applyPictureReview } from './picture-review';

export interface PipelineSettings {
  geminiKey: string;
  geminiModel: string;
  elevenKey: string;
  deepseekKey: string;
  deepseekModel: string;
  form: TopicForm;
  design: DesignSettings;
  voice: VoiceSettings;
  quality: string;
  /** Draw what stands beside the engineer (costs pictures). Off: he is on his own. */
  drawPictures: boolean;
}

export interface PlannedQuestion {
  exam: string;
  subject: string;
  topic: string;
  angle: string;
  difficulty: string;
}

export type PipelineStage = 'write' | 'check' | 'review' | 'formulas' | 'engineer' | 'pictures' | 'voice' | 'render';

export interface PipelineResult {
  videoId: string;
  /** done: rendered. review: stopped for a person to look. failed: an error. */
  status: 'done' | 'review' | 'failed';
  note: string;
  url?: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function makeVideo(
  q: PlannedQuestion,
  s: PipelineSettings,
  onStage: (stage: PipelineStage, detail: string) => void,
  shouldStop: () => boolean = () => false,
): Promise<PipelineResult> {
  const ledger: Spend[] = [];
  const restore = divertSpending((sp) => ledger.push(sp));
  let videoId = '';
  let content: QuizContent | null = null;
  let audio: Record<number, AudioResult> = {};
  const save = async () => {
    if (content && videoId) await api.librarySave({ id: videoId, content, design: s.design, audio, seo: null, ledger });
  };

  try {
    // 1. Write the question, as the Topic step would with this item filled in.
    onStage('write', q.topic);
    const form: TopicForm = {
      ...s.form,
      videoKind: 'mcq',
      provider: 'gemini',
      contentType: 'electrical',
      exam: q.exam,
      subject: q.subject || s.form.subject,
      topic: q.topic,
      difficulty: q.difficulty || s.form.difficulty,
      extra: [q.angle ? 'The question should test: ' + q.angle : '', s.form.extra].filter(Boolean).join('\n'),
      orientation: s.design.orientation,
    };
    content = (await api.generate(s.geminiKey.trim(), s.geminiModel, form)).content;
    videoId = (await api.libraryNewId()).id;
    await save();
    if (shouldStop()) return { videoId, status: 'review', note: 'Stopped after writing.' };

    // 2. The second opinion. A disagreement stops the batch for this video.
    if (s.deepseekKey.trim()) {
      onStage('check', 'DeepSeek is answering it independently');
      const { report } = await api.validate(s.deepseekKey.trim(), s.deepseekModel, content, form);
      if (report.agrees === false || report.verdict === 'fail') {
        return { videoId, status: 'review', note: 'DeepSeek disagrees with the marked answer - check it before making the video. ' + (report.summary || '') };
      }
    }

    // 3. The picture check: every diagram read against its line, with the
    // frame in front of the reviewer, and anything wrong or beside the point
    // taken out. Before the formula card and the engineer, because a scene that
    // loses its diagram is a scene the engineer now has to carry.
    onStage('review', 'Checking the pictures');
    try {
      const sent = content.script;
      const timeline = buildScenes(sent, {}, s.design, FPS, 0);
      const out = await api.reviewPictures({
        geminiKey: s.geminiKey.trim(), geminiModel: s.geminiModel, deepseekKey: s.deepseekKey.trim(), deepseekModel: s.deepseekModel,
        content, props: { content, scenes: timeline.scenes, design: s.design, fps: FPS, totalDurationInFrames: timeline.totalDurationInFrames },
      });
      const applied = applyPictureReview(content.script, sent, out.reviews);
      content = {
        ...content,
        script: applied.script,
        pictureReview: { checkedAt: new Date().toISOString(), by: out.by, sawFrames: out.sawFrames, reviews: applied.reviews, problems: out.problems },
      };
      await save();
    } catch (e) {
      // Unchecked pictures are not a reason to lose the video: it is left for a
      // person to look at, with the reason said.
      await save();
      return { videoId, status: 'review', note: 'The pictures could not be checked, so the video was not made: ' + (e instanceof Error ? e.message : String(e)) };
    }

    // 4. The formula card and the worked solution.
    onStage('formulas', 'Writing the formula card');
    try {
      const { sheet } = await api.formulas({ apiKey: s.geminiKey.trim(), model: s.geminiModel, content });
      const tidy = tidySheet(sheet);
      if (tidy) {
        let script = withFormulaScene(content.script).script;
        if (tidy.working && tidy.working.length) script = withWorking(script);
        content = { ...content, formulas: sheet, script };
      }
    } catch (e) {
      // A video without a formula card is still a video.
      onStage('formulas', 'No formula card: ' + (e instanceof Error ? e.message : String(e)));
    }
    await save();

    // 5. The animated engineer, in the Doodle look.
    if (s.design.layout === 'doodle') {
      onStage('engineer', 'Directing the engineer');
      const animated = s.design.animatedEngineer !== false;
      const scenes = doodleScenes(content.script, s.design.showVisuals);
      const out = await api.doodleDirections({
        apiKey: s.geminiKey.trim(), model: s.geminiModel, content, scenes, energy: s.design.doodleEnergy || 'lively', animated,
      });
      content = { ...content, script: content.script.map((line, i) => (out.directions[String(i)] ? { ...line, doodle: out.directions[String(i)] } : line)) };
      await save();

      if (s.drawPictures) {
        const todo = content.script.map((l, i) => (needsDrawing(l, animated) ? i : -1)).filter((i) => i >= 0);
        for (const [n, i] of todo.entries()) {
          onStage('pictures', 'Drawing ' + (n + 1) + ' of ' + todo.length);
          const line = content.script[i];
          const direction = tidyDirection(line.doodle);
          if (!direction) continue;
          const drawn = await api.doodleDraw({
            apiKey: s.geminiKey.trim(), modelId: 'gemini-3.1-flash-image', jobId: videoId, scene: i, kind: line.kind,
            direction, energy: s.design.doodleEnergy || 'lively', orientation: s.design.orientation, animated,
          });
          content = { ...content, script: content.script.map((l, j) => (j === i ? { ...l, doodleSrc: drawn.src, doodleProps: drawn.props === true } : l)) };
        }
        await save();
      }
    }
    if (shouldStop()) return { videoId, status: 'review', note: 'Stopped before the voiceover.' };

    // 6. The voice, recorded and measured.
    onStage('voice', 'Recording');
    audio = await recordVoice(s.elevenKey, s.voice, content.script, undefined, (p) =>
      onStage('voice', p.total ? p.done + ' of ' + p.total + ' scenes' : p.stage));
    await save();

    // 7. The render, recorded against the video by the server.
    onStage('render', 'Starting');
    const { scenes, totalDurationInFrames } = buildScenes(content.script, audio, s.design, FPS, tidySheet(content.formulas)?.cards.length ?? 0);
    const { jobId } = await api.startRender({ content, scenes, design: s.design, fps: FPS, totalDurationInFrames }, s.quality, videoId);
    for (;;) {
      await wait(1500);
      const status = await api.renderStatus(jobId);
      onStage('render', Math.round((status.progress || 0) * 100) + '%');
      if (status.status === 'error') throw new Error(status.error);
      if (status.status === 'done') return { videoId, status: 'done', note: '', url: status.url };
    }
  } catch (e) {
    await save().catch(() => undefined);
    return { videoId, status: 'failed', note: e instanceof Error ? e.message : String(e) };
  } finally {
    restore();
  }
}
