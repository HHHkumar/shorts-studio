import React, { useMemo, useState } from 'react';
import { api, fileToBase64 } from '../lib/api';
import { TRANSITIONS, type CaptionMode, type Design, type Grade, type Music, type Transition } from '../lib/types';
import { useStudio } from './context';
import { Check, ErrorNote, Slider, Spinner } from './controls';
import { MusicCues } from './MusicCues';
import { holdStats } from '../lib/beats';
import { buildTimeline } from '../lib/timeline';
import { FPS } from '../lib/types';

const CAPTIONS: { id: CaptionMode; t: string; s: string }[] = [
  { id: 'karaoke', t: 'Phrase + highlight', s: 'A short phrase at a time, the spoken word in gold.' },
  { id: 'plain', t: 'Phrase only', s: 'A short phrase at a time, all white. Like the reference.' },
  { id: 'boxed', t: 'Subtitle box', s: 'Plain white words on a dark box, like film subtitles. Suits fast cartoon explainers.' },
  { id: 'off', t: 'No captions', s: 'Pictures and voice only.' },
];

const GRADES: { id: Grade; t: string }[] = [
  { id: 'none', t: 'Natural' },
  { id: 'warm', t: 'Warm' },
  { id: 'sepia', t: 'Sepia / old film' },
  { id: 'cool', t: 'Cool' },
  { id: 'faded', t: 'Faded' },
];

const MUSIC: { id: Music; t: string }[] = [
  { id: 'none', t: 'No music' },
  { id: 'calm', t: 'Calm bed' },
  { id: 'tense', t: 'Tense bed' },
  { id: 'upbeat', t: 'Upbeat bed' },
  { id: 'custom', t: 'Her own track' },
];

/** Whole looks in one click: the picture style and the settings that suit it. */
const LOOKS: { id: string; label: string; hint: string; styleId: string; design: Partial<Design> }[] = [
  {
    id: 'fast-ink', label: '✏️ Fast ink cartoon', styleId: 'ink',
    hint: 'Ink cartoon pictures, subtitle-box captions, hard cuts, no colour grade. Pair it with a 2-second storyboard on the Scenes step.',
    design: { captions: 'boxed', transition: 'cut', crossfade: 0.25, grade: 'none', grain: 0.1, vignette: 0.15, motionAmount: 0.5, pace: 3, beats: 'zoom' },
  },
  {
    id: 'comic', label: '🎨 Classic comic', styleId: 'comic',
    hint: 'Bold comic pictures, gold-highlight captions, crossfades and a warm grade - the original look.',
    design: { captions: 'karaoke', transition: 'crossfade', crossfade: 0.6, grade: 'warm', grain: 0.35, vignette: 0.45, motionAmount: 0.6, pace: 3, beats: 'mix' },
  },
];

export const StepLook: React.FC = () => {
  const { project, update, goStep } = useStudio();
  const d = project.design;
  const stats = useMemo(() => holdStats(buildTimeline(project).scenes, FPS), [project]);
  const set = (patch: Partial<Design>) => update((p) => ({ ...p, design: { ...p.design, ...patch } }));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMusic = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const r = await api.uploadMusic({ projectId: project.id, fileName: file.name, dataBase64: await fileToBase64(file) });
      set({ music: 'custom', musicSrc: r.src, musicName: r.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Look & sound</h2>
      <p className="lede">Every change shows up in the preview straight away.</p>

      <div className="row" style={{ marginTop: 0, marginBottom: 18 }}>
        <span className="stat">One-click looks:</span>
        {LOOKS.map((l) => (
          <button key={l.id} className="btn small" title={l.hint} onClick={() => update((p) => ({ ...p, styleId: l.styleId, design: { ...p.design, ...l.design } }))}>{l.label}</button>
        ))}
        <span className="stat">Sets the picture style too — pictures already drawn keep their look until redrawn.</span>
      </div>

      <div className="section-title">Captions</div>
      <div className="tiles">
        {CAPTIONS.map((c) => (
          <button key={c.id} className={'tile' + (d.captions === c.id ? ' active' : '')} onClick={() => set({ captions: c.id })}>
            <div className="t">{c.t}</div>
            <div className="s">{c.s}</div>
          </button>
        ))}
      </div>
      {d.captions !== 'off' ? (
        <div style={{ maxWidth: 420, marginTop: 12 }}>
          <Slider label="Caption size" value={d.captionSize} min={36} max={80} step={2} suffix="px" onChange={(v) => set({ captionSize: v })} />
        </div>
      ) : null}

      <div className="section-title" style={{ marginTop: 26 }}>Pictures</div>
      <div className="grid">
        <Slider label="Camera movement" value={d.motionAmount} min={0} max={1} step={0.05} onChange={(v) => set({ motionAmount: v })} hint="How far the slow zooms and pans travel." />
        <Slider label="Transition length" value={d.crossfade} min={0} max={1.5} step={0.1} suffix="s" onChange={(v) => set({ crossfade: v })} hint="How long each scene change takes." />
        <Slider label="Film grain" value={d.grain} min={0} max={1} step={0.05} onChange={(v) => set({ grain: v })} />
        <Slider label="Vignette" value={d.vignette} min={0} max={1} step={0.05} onChange={(v) => set({ vignette: v })} />
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Default scene transition</label>
        <div className="tiles">
          {TRANSITIONS.filter((x) => x.id !== 'auto').map((x) => (
            <button key={x.id} className={'tile' + (d.transition === x.id ? ' active' : '')} onClick={() => set({ transition: x.id as Exclude<Transition, 'auto'> })}>
              <div className="t">{x.label}</div>
            </button>
          ))}
        </div>
        <div className="hint">Any scene can pick its own on the Scenes step. Showy ones work best sparingly — at chapter changes.</div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Colour grade</label>
        <div className="tiles">
          {GRADES.map((g) => (
            <button key={g.id} className={'tile' + (d.grade === g.id ? ' active' : '')} onClick={() => set({ grade: g.id })}>
              <div className="t">{g.t}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Check label="Show the title over the opening" checked={d.titleCard} onChange={(v) => set({ titleCard: v })} hint={(project.title ? '“' + project.title + '”' : 'Set a title on the Story step.') + ' Left out when the video opens on a graphic — a headline or chart already has its own words.'} />
        {project.kind === 'news' ? (
          <Check label="Show sources on screen" checked={d.showSources} onChange={(v) => set({ showSources: v })} hint="A small “Source: Reuters · The Hindu” tag under the captions on each scene that has sources." />
        ) : null}
        <div className="field" style={{ marginTop: 10, maxWidth: 520 }}>
          <label>On-screen credits for stock photos & videos</label>
          <select value={d.credits} onChange={(e) => set({ credits: e.target.value as Design['credits'] })}>
            <option value="required">Only where the licence requires it (CC BY / BY-SA) — recommended</option>
            <option value="all">For all stock</option>
            <option value="off">None (add them to the description instead)</option>
          </select>
          <div className="hint">A small “Photo: name / Wikimedia Commons, CC BY-SA 4.0” at the bottom-right of that shot.</div>
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Graphics colours (maps, charts, quotes…)</label>
        <div className="tiles">
          {([['night', 'Night newsroom'], ['paper', 'Newspaper'], ['bold', 'Bold black']] as const).map(([id, label]) => (
            <button key={id} className={'tile' + (d.graphicTheme === id ? ' active' : '')} onClick={() => set({ graphicTheme: id })}>
              <div className="t">{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 26 }}>Pacing & music</div>
      <div className="field">
        <label>Something new on screen at least every…</label>
        <div className="tiles">
          {([[0, 'Off'], [4, '4 seconds'], [3, '3 seconds'], [2, '2 seconds']] as const).map(([v, label]) => (
            <button key={v} className={'tile' + (d.pace === v ? ' active' : '')} onClick={() => set({ pace: v })}>
              <div className="t">{label}</div>
            </button>
          ))}
        </div>
        {d.pace ? (
          <div className="tiles" style={{ marginTop: 8 }}>
            {([['mix', 'Mix', 'Punch-ins and key words, taking turns'], ['zoom', 'Punch-ins', 'Snap zooms onto details, then back out'], ['words', 'Key words', 'Numbers and names stamped on screen as they are said']] as const).map(([id, label, hint]) => (
              <button key={id} className={'tile' + (d.beats === id ? ' active' : '')} onClick={() => set({ beats: id })} title={hint}>
                <div className="t">{label}</div>
                <div className="s">{hint}</div>
              </button>
            ))}
          </div>
        ) : null}
        <div className="hint">
          Fills any stretch longer than this with no cut or callout: a snap zoom onto a detail, or a key word (“300 MPs”, “New Delhi”) as it is spoken.
          {' '}Longest hold now: <b>{stats.longest.toFixed(1)}s</b>{stats.beats ? ' (' + stats.withoutBeats.toFixed(1) + 's without beats, ' + stats.beats + ' beats added)' : ''}.
          {' '}More real pictures help most: <b>⏱ Plan cut-aways</b> on the Scenes step.
        </div>
      </div>
      <div className="grid">
        <Slider label="Pause after each scene" value={d.breath} min={0} max={1.5} step={0.05} suffix="s" onChange={(v) => set({ breath: v })} hint="A breath between lines so it never feels rushed." />
        <Slider label="Music volume" value={d.musicVolume} min={0} max={0.5} step={0.01} onChange={(v) => set({ musicVolume: v })} hint="Keep it low under narration: 0.08–0.15." />
        <Slider label="Sound effects" value={d.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => set({ sfxVolume: v })} hint="Whooshes on transitions, pops on callouts, a hit on chapter cards." />
        <Slider label="Ambience" value={d.ambienceVolume} min={0} max={1} step={0.05} onChange={(v) => set({ ambienceVolume: v })} hint="Wind under heat haze and dust, crackle under fire, rain under rain." />
        <Slider label="Chapter card hold" value={d.chapterHold} min={0.8} max={3} step={0.1} suffix="s" onChange={(v) => set({ chapterHold: v })} hint="Pause for the chapter title before the narration carries on." />
      </div>
      <div style={{ marginTop: 10 }}>
        <Check label="Duck the music under the voice" checked={d.duck} onChange={(v) => set({ duck: v })} hint="Music dips while she speaks and swells back in the pauses." />
      </div>
      <div className="tiles" style={{ marginTop: 12 }}>
        {MUSIC.map((m) => (
          <button key={m.id} className={'tile' + (d.music === m.id ? ' active' : '')} onClick={() => set({ music: m.id })}>
            <div className="t">{m.t}</div>
            {m.id === 'custom' && d.musicName ? <div className="s">{d.musicName}</div> : null}
          </button>
        ))}
      </div>
      {d.music === 'custom' ? (
        <div className="actions" style={{ marginTop: 12 }}>
          <label className="btn small" style={{ cursor: 'pointer' }}>
            {uploading ? <Spinner /> : '⬆'} {d.musicSrc ? 'Replace track' : 'Upload a music track'}
            <input type="file" accept="audio/*" hidden onChange={(e) => { uploadMusic(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <span className="stat" style={{ alignSelf: 'center' }}>MP3, WAV or M4A. It loops if shorter than the video. Use music she has the rights to.</span>
        </div>
      ) : null}
      <ErrorNote error={error} />
      <MusicCues />

      <div className="actions">
        <div className="spacer" />
        <button className="btn primary" onClick={() => goStep(5)}>Next: render →</button>
      </div>
    </div>
  );
};
