import React, { useState } from 'react';
import { api } from '../lib/api';
import type { QuizContent } from '../lib/types';
import { ErrorNote, Spinner } from './controls';

// ---------------------------------------------------------------------------
// Other ways to open the video (server/hooks.mjs): four hooks in different
// styles for the first line, or three thumbnail headlines. One free Gemini
// text request; press a suggestion to use it. None gives the answer away.
// ---------------------------------------------------------------------------

export const HookIdeas: React.FC<{
  content: QuizContent;
  geminiKey: string;
  geminiModel: string;
  /** Which list to offer: opening lines, or thumbnail headlines. */
  want: 'hooks' | 'headlines';
  onPick: (text: string) => void;
}> = ({ content, geminiKey, geminiModel, want, onPick }) => {
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await api.hooks({ apiKey: geminiKey, model: geminiModel || 'gemini-2.5-flash', content });
      const list = want === 'hooks' ? out.hooks : out.headlines;
      setIdeas(list);
      if (!list.length) setError('Nothing usable came back - every idea gave the answer away or ran long. Try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hook-ideas">
      <button className="btn small ghost" onClick={ask} disabled={busy || geminiKey.trim().length < 6}>
        {busy ? <Spinner /> : '💡'} {ideas ? 'More ideas' : want === 'hooks' ? 'Other hooks' : 'Headline ideas'}
      </button>
      <ErrorNote error={error} />
      {ideas && ideas.length ? (
        <div className="hook-chips">
          {ideas.map((idea) => (
            <button key={idea} className="hook-chip" onClick={() => onPick(idea)} title="Use this one">
              {idea.replace(/\*/g, '')}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
