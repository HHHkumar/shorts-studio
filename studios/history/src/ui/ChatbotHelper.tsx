// ---------------------------------------------------------------------------
// "No API credits? Use any chatbot."
//
// Every AI button in the studio has this beside it. It copies the exact job the
// API would have been given - instructions, the script, and the answer format -
// as one message for the Gemini app, ChatGPT or Claude.ai. She pastes the reply
// back and it is read through the same checks as an API answer, so the result
// is applied exactly the same way.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import { ErrorNote, Spinner } from './controls';

const CHATBOTS = [
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Claude', url: 'https://claude.ai/new' },
];

export function ChatbotHelper<T>({ task, body, onResult, picture, label = 'No API credits? Do this with any chatbot' }: {
  task: string;
  /** Built when the prompt is copied, so it is always the current script. */
  body: () => object;
  onResult: (r: T) => void;
  /** For jobs that need to see a picture: shown with a save link, to attach in the chat. */
  picture?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<'' | 'copy' | 'use'>('');
  const [copied, setCopied] = useState(0);
  const [needsPicture, setNeedsPicture] = useState(Boolean(picture));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const copy = async () => {
    setBusy('copy');
    setError(null);
    try {
      const r = await api.chatPrompt(task, body());
      await navigator.clipboard.writeText(r.prompt);
      setCopied(r.prompt.length);
      setNeedsPicture(r.needsPicture);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const use = async () => {
    setBusy('use');
    setError(null);
    try {
      onResult(await api.chatImport<T>(task, body(), reply));
      setDone(true);
      setReply('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  if (!open) {
    return <button className="link-btn chatbot-link" onClick={() => setOpen(true)}>💬 {label}</button>;
  }

  return (
    <div className="chatbot">
      <div className="chatbot-head">
        <b>💬 Use any chatbot instead of an API key</b>
        <button className="link-btn" onClick={() => setOpen(false)}>close</button>
      </div>
      <ol>
        <li>
          <button className="btn small" disabled={Boolean(busy)} onClick={copy}>{busy === 'copy' ? <Spinner /> : '📋'} Copy the prompt</button>
          {copied ? <span className="stat"> copied ({copied.toLocaleString()} characters)</span> : null}
        </li>
        <li>
          Paste it into{' '}
          {CHATBOTS.map((c, i) => (
            <React.Fragment key={c.name}>
              <a href={c.url} target="_blank" rel="noreferrer">{c.name}</a>{i < CHATBOTS.length - 1 ? ', ' : ''}
            </React.Fragment>
          ))}{' '}
          or any other chatbot{needsPicture && picture ? <> — and <b>attach this picture</b>: <a href={mediaUrl(picture)} download>save it</a></> : null}.
          {' '}If it stops part way, ask it to “continue” and paste both parts below.
        </li>
        <li>
          Paste its whole reply here:
          <textarea value={reply} onChange={(e) => { setReply(e.target.value); setDone(false); }} placeholder="```json&#10;{ ... }&#10;```" />
          <button className="btn small primary" disabled={Boolean(busy) || !reply.trim()} onClick={use}>{busy === 'use' ? <Spinner /> : '✔'} Use this reply</button>
          {done ? <span className="stat good"> Done — applied.</span> : null}
        </li>
      </ol>
      <ErrorNote error={error} />
    </div>
  );
}
