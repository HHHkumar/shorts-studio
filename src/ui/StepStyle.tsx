import React, { useRef, useState } from 'react';
import { api } from '../lib/api';
import { getTheme, LAYOUT_INFO } from '../lib/theme';
import type { DesignSettings, LayoutName, MusicMood, QuizContent, ThemeMode } from '../lib/types';
import { Check, ErrorNote, Note, Select, Slider, Spinner } from './controls';
import { StockPicker } from './StockPicker';

const ACCENTS = [
  { name: 'Layout default', value: '' },
  { name: 'Electric blue', value: '#4c9aff' },
  { name: 'Mint', value: '#3ddc97' },
  { name: 'Gold', value: '#ffd400' },
  { name: 'Hot pink', value: '#ff2e88' },
  { name: 'Violet', value: '#a76bff' },
  { name: 'Orange', value: '#ff7a00' },
];

export const StepStyle: React.FC<{
  design: DesignSettings;
  setDesign: (updater: (prev: DesignSettings) => DesignSettings) => void;
  musicMoods: { id: string; label: string }[];
  content: QuizContent | null;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  pexelsKey: string;
  onBack: () => void;
  onNext: () => void;
}> = ({ design, setDesign, musicMoods, content, setContent, pexelsKey, onBack, onNext }) => {
  const set = <K extends keyof DesignSettings>(key: K, value: DesignSettings[K]) =>
    setDesign((prev) => ({ ...prev, [key]: value }));

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickTrack = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await api.uploadMusic(file);
      setTrackName(result.name);
      setDesign((prev) => ({ ...prev, music: 'custom', customMusicSrc: result.src }));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const moodOptions = [
    ...musicMoods,
    ...(design.customMusicSrc ? [{ id: 'custom', label: 'My own track' + (trackName ? ' — ' + trackName : '') }] : []),
  ];

  return (
    <div className="panel">
      <h2>Step 5 — Pick the look</h2>
      <p className="lede">
        Change anything here as often as you like — it is instant, it costs nothing, and it never
        touches the voiceover. Watch the phone preview on the right.
      </p>

      <div className="section-title">Dark or light</div>
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(['dark', 'light'] as ThemeMode[]).map((mode) => (
          <button
            key={mode}
            className={'tile' + (design.mode === mode ? ' active' : '')}
            onClick={() => set('mode', mode)}
          >
            <div className="t">{mode === 'dark' ? '🌙 Dark' : '☀️ Light'}</div>
            <div className="s">
              {mode === 'dark' ? 'Best for evening scrolling. The default for Shorts.' : 'Bright and clean. Reads well in daylight.'}
            </div>
          </button>
        ))}
      </div>

      <div className="section-title">Layout</div>
      <div className="tiles">
        {LAYOUT_INFO.map((info) => {
          const t = getTheme({ ...design, layout: info.name as LayoutName });
          return (
            <button
              key={info.name}
              className={'tile' + (design.layout === info.name ? ' active' : '')}
              onClick={() => set('layout', info.name)}
            >
              <div className="t">{info.label}</div>
              <div className="s">{info.blurb}</div>
              <div className="swatches">
                <i style={{ background: t.bg }} />
                <i style={{ background: t.accent }} />
                <i style={{ background: t.text }} />
                <i style={{ background: t.correct }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="section-title">Highlight colour</div>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {ACCENTS.map((a) => (
          <button
            key={a.name}
            className={'tile' + (design.accent === a.value ? ' active' : '')}
            onClick={() => set('accent', a.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <i
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                flex: '0 0 auto',
                background: a.value || 'linear-gradient(135deg,#4c9aff,#ff2e88)',
                border: '1px solid rgba(255,255,255,.2)',
              }}
            />
            <span className="t" style={{ margin: 0, fontSize: 14 }}>
              {a.name}
            </span>
          </button>
        ))}
      </div>

      <div className="section-title">Timing and extras</div>
      <div className="grid">
        <Slider
          label="Thinking time"
          value={design.countdownSeconds}
          min={0}
          max={10}
          step={1}
          suffix="s"
          onChange={(v) => set('countdownSeconds', v)}
          hint="How long the countdown timer runs before the answer. 3–5 seconds is normal."
        />
        <Slider
          label="Breathing room"
          value={design.scenePaddingSeconds}
          min={0}
          max={1}
          step={0.05}
          suffix="s"
          onChange={(v) => set('scenePaddingSeconds', v)}
          hint="Extra silence after each spoken line. Raise it if the video feels rushed."
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <Check
          label="Show the spoken words on screen"
          hint="The narration itself is the on-screen text, highlighting word by word as it is said. Most viewers watch on mute, so leave this on."
          checked={design.showCaptions}
          onChange={(v) => set('showCaptions', v)}
        />
        <Check
          label="Show the progress bar at the top"
          hint="A thin line that fills up across the video. Helps people stay to the end."
          checked={design.showProgressBar}
          onChange={(v) => set('showProgressBar', v)}
        />
        <Check
          label="Draw the diagrams"
          hint="Formulas, comparison bars and side-by-side panels that Gemini picked for each scene."
          checked={design.showVisuals}
          onChange={(v) => set('showVisuals', v)}
        />
        <Check
          label="Drift topic symbols in the background"
          hint="Faint themed emoji floating behind everything, so a text-only video does not look like a slide deck."
          checked={design.showMotif}
          onChange={(v) => set('showMotif', v)}
        />
        <Check
          label="Show backdrop photos"
          hint="Dimmed photos behind the text, chosen by you scene by scene below."
          checked={design.showStock}
          onChange={(v) => set('showStock', v)}
        />
        <Check
          label="Trim trailing silence"
          hint="Cuts the dead air the voice leaves at the end of each line. Turn off if any line sounds clipped."
          checked={design.trimTrailingSilence}
          onChange={(v) => set('trimTrailingSilence', v)}
        />
      </div>

      <div className="section-title">Backdrop photos</div>
      {content ? (
        <StockPicker
          content={content}
          setContent={setContent}
          pexelsKey={pexelsKey}
          orientation={design.orientation}
          showStock={design.showStock}
          stockOpacity={design.stockOpacity}
          setStockOpacity={(v) => set('stockOpacity', v)}
        />
      ) : null}

      <div className="section-title">Sound</div>
      <div className="grid">
        <Select
          label="Background music"
          value={design.music}
          options={moodOptions}
          onChange={(v) => set('music', v as MusicMood)}
          hint="The music automatically drops under the narration, so it never fights the voice."
        />
        <Slider
          label="Music volume"
          value={design.musicVolume}
          min={0}
          max={0.6}
          step={0.02}
          onChange={(v) => set('musicVolume', v)}
          hint="0.20 to 0.25 sits nicely behind a voice. Higher starts to compete."
        />
      </div>

      <div className="actions" style={{ marginTop: 12 }}>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => pickTrack(e.target.files?.[0])}
        />
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner /> : '🎵'} Use my own music file
        </button>
        {design.customMusicSrc ? (
          <button
            className="btn ghost"
            onClick={() => {
              setTrackName('');
              setDesign((prev) => ({ ...prev, music: 'calm', customMusicSrc: '' }));
            }}
          >
            Remove my track
          </button>
        ) : null}
      </div>
      <ErrorNote error={uploadError} />

      <div style={{ marginTop: 8 }}>
        <Check
          label="Sound effects"
          hint="A tick each countdown second, a whoosh as options arrive, a chime on the answer, and a sweep between scenes."
          checked={design.sfx}
          onChange={(v) => set('sfx', v)}
        />
      </div>
      {design.sfx ? (
        <div className="grid" style={{ marginTop: 8 }}>
          <Slider
            label="Effects volume"
            value={design.sfxVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => set('sfxVolume', v)}
          />
        </div>
      ) : null}

      <Note kind="info" title="Tip">
        Press play on the phone preview and skim through before rendering. Fixing something here takes a
        second; fixing it after a render takes a few minutes.
      </Note>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          ← Back to the voice
        </button>
        <div className="spacer" />
        <button className="btn primary" onClick={onNext}>
          Make the video →
        </button>
      </div>
    </div>
  );
};
