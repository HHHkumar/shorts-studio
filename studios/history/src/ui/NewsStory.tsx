// ---------------------------------------------------------------------------
// The News form on the Story step.
//
//   1. a story - typed, or picked from "Suggest trending stories" (live search)
//   2. Research & write: a live-searched, sourced brief, then the script from it
//   3. the sources and the "check before publishing" notes, up front
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { api, type NewsResult, type TrendingStory } from '../lib/api';
import { applyNews, NEWS_REGIONS, todayIso } from '../lib/news';
import { prettyDate } from '../lib/timeline';
import { useStudio } from './context';
import { ChatbotHelper } from './ChatbotHelper';
import { supportsTags } from '../lib/speech';
import { ErrorNote, Note, Select, Slider, Spinner, TextArea, TextInput } from './controls';

const CATEGORIES = ['Politics', 'International', 'Science', 'Tech', 'Policy', 'Business', 'Health', 'Climate'];

const TONES = [
  { id: 'clear', t: 'Clear & calm', s: 'Like a good public broadcaster. Plain, warm, serious.' },
  { id: 'energetic', t: 'Energetic explainer', s: 'Punchy hook, fast rhythm, vivid comparisons. Never sensational.' },
  { id: 'story', t: 'Storytelling', s: 'Opens on a real moment or person affected, then widens out.' },
];

export const NewsStory: React.FC<{ confirmReplace: () => boolean; writerPicker: React.ReactNode; languages: string[] }> = ({ confirmReplace, writerPicker, languages }) => {
  const { project, update, keys, prefs, goStep } = useStudio();
  const [angle, setAngle] = useState('');
  const [minutes, setMinutes] = useState(4);
  const [tone, setTone] = useState('clear');
  const [cats, setCats] = useState<string[]>(['Politics', 'International', 'Science', 'Tech', 'Policy']);
  const [stories, setStories] = useState<TrendingStory[]>([]);
  const [busy, setBusy] = useState<'' | 'trending' | 'research' | 'write'>('');
  const [error, setError] = useState<string | null>(null);
  const writerKey = prefs.writer === 'claude' ? keys.claude : keys.gemini;
  const model = prefs.writer === 'claude' ? prefs.claudeModel : prefs.geminiModel;
  const region = project.region || 'India + global';
  const asOf = todayIso();
  const voiceTags = project.voice.mode === 'eleven' && supportsTags(project.voice.modelId);

  const findStories = async () => {
    setBusy('trending');
    setError(null);
    try {
      const r = await api.newsTrending({ provider: prefs.writer, model, categories: cats, region, asOf });
      setStories(r.items);
      if (!r.items.length) setError('No stories came back. Try again, or choose other categories.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const write = async () => {
    if (!confirmReplace()) return;
    setError(null);
    try {
      setBusy('research');
      const { brief, sources } = await api.newsResearch({ provider: prefs.writer, model, story: project.topic, region, angle, asOf });
      setBusy('write');
      const r = await api.writeNews({ provider: prefs.writer, model, story: project.topic, region, angle, asOf, minutes, tone, language: project.language, brief, sources, voiceTags });
      update((p) => applyNews({ ...p, title: '' }, r, asOf));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const chatBody = () => ({ story: project.topic, region, angle, asOf, minutes, tone, language: project.language, voiceTags });

  return (
    <>
      <div className="grid" style={{ marginTop: 18 }}>
        <Select label="Narration language" value={project.language} options={languages} onChange={(v) => update((p) => ({ ...p, language: v }))} />
        <Select label="Region / audience" value={region} options={NEWS_REGIONS} onChange={(v) => update((p) => ({ ...p, region: v }))} />
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>The story</div>
      <TextInput
        label="Which news story?"
        value={project.topic}
        placeholder="e.g. The new India–EU trade deal, explained"
        onChange={(v) => update((p) => ({ ...p, topic: v }))}
      />
      <div className="trend-box">
        <div className="row" style={{ marginTop: 0 }}>
          {CATEGORIES.map((c) => (
            <button key={c} className={'chip' + (cats.includes(c) ? ' on' : '')} onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</button>
          ))}
          <button className="btn small" disabled={Boolean(busy) || !writerKey || !cats.length} onClick={findStories} title={writerKey ? '' : 'Needs a Gemini or Claude key (live search)'}>
            {busy === 'trending' ? <><Spinner /> Searching the news…</> : '🔥 Suggest trending stories'}
          </button>
        </div>
        {stories.length ? (
          <div className="stories">
            {stories.map((s, i) => (
              <button key={i} className={'story' + (project.topic === s.headline ? ' on' : '')} onClick={() => { update((p) => ({ ...p, topic: s.headline })); setAngle(s.why); }}>
                <div className="story-head">
                  <span className="pill">{s.category}</span>
                  {s.date ? <span className="stat">{prettyDate(s.date) || s.date}</span> : null}
                  <span className="heat" title={'How big: ' + s.heat + '/10'}>{'🔥'.repeat(Math.max(1, Math.round(s.heat / 3.4)))}</span>
                </div>
                <div className="t">{s.headline}</div>
                <div className="s">{s.summary}</div>
                {s.why ? <div className="s why">Why it matters: {s.why}</div> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <TextArea label="Angle or questions to answer (optional)" value={angle} onChange={setAngle} rows={2}
          placeholder="e.g. What changes for farmers and small exporters? Why did it take 18 years?" />
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>Voice of the explainer</div>
      <div className="tiles">
        {TONES.map((t) => (
          <button key={t.id} className={'tile' + (tone === t.id ? ' active' : '')} onClick={() => setTone(t.id)}>
            <div className="t">{t.t}</div>
            <div className="s">{t.s}</div>
          </button>
        ))}
      </div>
      <div className="grid" style={{ marginTop: 16 }}>
        <Slider label="Length" value={minutes} min={1} max={12} step={1} suffix=" min" onChange={setMinutes} hint={'About ' + minutes * 150 + ' words. 3–6 minutes suits most news.'} />
        <div />
      </div>
      <div style={{ marginTop: 16 }}>{writerPicker}</div>

      <Note kind="info">
        News is researched <b style={{ display: 'inline' }}>live</b> first: the writer only uses what today’s reporting says, keeps every source,
        gives each side fairly, and never fakes pictures of real people — numbers, places, quotes and people become graphics instead.
        Reporting is dated <b style={{ display: 'inline' }}>{prettyDate(asOf)}</b>.
      </Note>
      <ErrorNote error={error} />
      {!writerKey ? <Note kind="warn">No {prefs.writer === 'claude' ? 'Claude' : 'Gemini'} key — use any chatbot with web browsing below, or add a key on the Keys step.</Note> : null}
      <div className="actions">
        <button className="btn primary big" disabled={!writerKey || !project.topic.trim() || Boolean(busy)} onClick={write}>
          {busy === 'research' ? <><Spinner /> Researching live… (searching and cross-checking)</>
            : busy === 'write' ? <><Spinner /> Writing the explainer…</>
              : project.scenes.length ? '↻ Research & write again' : '🔎 Research & write (live search)'}
        </button>
      </div>
      {project.topic.trim() ? (
        <ChatbotHelper<NewsResult>
          task="news"
          body={chatBody}
          label="Research & write with any chatbot instead (it must be able to browse the web)"
          onResult={(r) => { if (confirmReplace()) update((p) => applyNews({ ...p, title: '' }, r, asOf)); }}
        />
      ) : null}

      {project.kind === 'news' && project.scenes.length ? (
        <>
          <div className="section-title" style={{ marginTop: 26 }}>Sources ({project.sources.length}) · as of {prettyDate(project.asOf)}</div>
          <ol className="sources">
            {project.sources.map((s, i) => (
              <li key={i}>
                <b>{s.publisher || 'Source'}</b> — {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a> : s.title}
                {s.date ? <span className="stat"> · {s.date}</span> : null}
              </li>
            ))}
          </ol>
          {project.publish.factNotes.length ? (
            <Note kind="warn" title="Check before publishing (disputed, developing or single-sourced)">
              <ul className="facts">{project.publish.factNotes.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </Note>
          ) : null}
          <div className="actions">
            <span className="stat" style={{ alignSelf: 'center' }}>
              <b>{project.scenes.length}</b> scenes · <b>{project.scenes.filter((s) => s.shots[0].graphic).length}</b> graphics
            </span>
            <div className="spacer" />
            <button className="btn primary" onClick={() => goStep(2)}>Next: scenes, graphics & pictures →</button>
          </div>
        </>
      ) : null}
    </>
  );
};
