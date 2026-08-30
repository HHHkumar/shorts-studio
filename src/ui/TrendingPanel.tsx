import React, { useState } from 'react';
import { api, type TopicForm, type TrendingResult } from '../lib/api';
import { ErrorNote, Note, Spinner } from './controls';

/**
 * "What is worth making a video about right now?"
 *
 * Gemini searches the live web and comes back with topics that are actually
 * being discussed, each with the angle a video should be built around. Picking
 * one fills in the topic box; the normal generator does the rest.
 *
 * The pages it consulted are shown alongside, because a trending claim is
 * exactly the kind that turns out to be half true.
 */
export const TrendingPanel: React.FC<{
  form: TopicForm;
  geminiKey: string;
  geminiModel: string;
  onPick: (topic: string) => void;
}> = ({ form, geminiKey, geminiModel, onPick }) => {
  const [result, setResult] = useState<TrendingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState('');

  const look = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.trending(geminiKey.trim(), geminiModel, {
        contentType: form.contentType,
        subject: form.subject,
        exam: form.exam,
        region: 'India',
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn" onClick={look} disabled={busy || geminiKey.trim().length < 10}>
          {busy ? <Spinner /> : '🔥'} {result ? 'Look again' : 'What is trending now?'}
        </button>
        <div className="spacer" />
        {result ? (
          <span style={{ alignSelf: 'center', color: 'var(--dim)', fontSize: 13.5 }}>
            {result.items.length} ideas · searched the live web
          </span>
        ) : null}
      </div>

      {busy ? (
        <Note kind="info">
          Searching the web and judging which results would actually make a good video. This takes
          10–30 seconds.
        </Note>
      ) : null}

      <ErrorNote error={error} />

      {result && !busy ? (
        <>
          <div className="trend-list">
            {result.items.map((item, i) => (
              <button
                key={i}
                className={'trend' + (picked === item.topic ? ' active' : '')}
                onClick={() => {
                  setPicked(item.topic);
                  onPick(item.topic);
                }}
              >
                <div className="trend-head">
                  <span className="topic">{item.topic}</span>
                  <span className="heat" title={item.heat + ' out of 10'}>
                    {'🔥'.repeat(Math.max(1, Math.round(item.heat / 3.4)))}
                  </span>
                </div>
                {item.why ? <div className="why">{item.why}</div> : null}
                {item.angle ? <div className="angle">→ {item.angle}</div> : null}
              </button>
            ))}
          </div>

          <Note kind="warn" title="Trending is not the same as true">
            These come off live web pages, and a story that is spreading fast is exactly the kind
            that turns out to be half right. Check the answer in step 3 — and run the DeepSeek check
            if you have a key.
          </Note>

          {result.sources.length ? (
            <details className="help">
              <summary>Where this came from ({result.sources.length} pages)</summary>
              <div className="inner">
                {result.searches.length ? (
                  <p style={{ margin: '0 0 8px' }}>
                    Searched for: {result.searches.map((s) => '“' + s + '”').join(', ')}
                  </p>
                ) : null}
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.sources.map((s, i) => (
                    <li key={i} style={{ margin: '4px 0' }}>
                      <a href={s.uri} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </>
  );
};
