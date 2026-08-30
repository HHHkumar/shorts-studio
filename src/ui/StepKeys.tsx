import React, { useState } from 'react';
import { ErrorNote, Note, Spinner, TextInput } from './controls';

interface CheckResult {
  gemini: string;
  elevenlabs: string;
  deepseek: string;
  elevenlabsQuota?: { used: number; limit: number; left: number };
}

export const StepKeys: React.FC<{
  geminiKey: string;
  elevenKey: string;
  deepseekKey: string;
  pexelsKey: string;
  setGeminiKey: (v: string) => void;
  setElevenKey: (v: string) => void;
  setDeepseekKey: (v: string) => void;
  setPexelsKey: (v: string) => void;
  onNext: () => void;
}> = ({
  geminiKey,
  elevenKey,
  deepseekKey,
  pexelsKey,
  setGeminiKey,
  setElevenKey,
  setDeepseekKey,
  setPexelsKey,
  onNext,
}) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bothFilled = geminiKey.trim().length > 10 && elevenKey.trim().length > 10;

  const check = async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/check-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiKey: geminiKey.trim(),
          elevenKey: elevenKey.trim(),
          deepseekKey: deepseekKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not check the keys.');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="panel">
      <h2>Step 1 — Your API keys</h2>
      <p className="lede">
        Google Gemini writes the question and ElevenLabs reads it out loud, so you need a free key
        from each. DeepSeek is optional: it double-checks the answer. You only do this once.
      </p>

      <Note kind="info" title="Where do I get them? (2 minutes each)">
        <ol>
          <li>
            <b>Gemini key</b> — go to{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/app/apikey
            </a>
            , sign in with a Google account, click <b>Create API key</b>, then copy it. It starts with{' '}
            <span className="kbd">AIza…</span>
          </li>
          <li>
            <b>ElevenLabs key</b> — go to{' '}
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer">
              elevenlabs.io → Settings → API Keys
            </a>
            , sign in, click <b>Create API key</b>, then copy it. It starts with{' '}
            <span className="kbd">sk_…</span>
          </li>
        </ol>
      </Note>

      <div className="grid full">
        <TextInput
          label="Gemini API key"
          password
          value={geminiKey}
          onChange={setGeminiKey}
          placeholder="AIza..."
          hint="Used to write the question, the explanation and the narration script."
        />
        <TextInput
          label="ElevenLabs API key"
          password
          value={elevenKey}
          onChange={setElevenKey}
          placeholder="sk_..."
          hint="Used to turn the narration script into a human-sounding voiceover."
        />
        <TextInput
          label="DeepSeek API key — optional"
          password
          value={deepseekKey}
          onChange={setDeepseekKey}
          placeholder="sk-..."
          hint="A second model that checks Gemini's answer before you spend voice credits on it. Leave empty to skip the check."
        />
        <TextInput
          label="Pexels API key — optional"
          password
          value={pexelsKey}
          onChange={setPexelsKey}
          placeholder="free key from pexels.com/api"
          hint="Lets step 5 search for backdrop photos. NASA's public-domain library is searched too, and needs no key."
        />
      </div>

      <Note kind="info" title="Why a second model? (optional but recommended)">
        Gemini writes the question <em>and</em> marks its own answer, so a confidently wrong answer has
        nothing to catch it. With a DeepSeek key, step 3 can hand the question to a different model that
        solves it independently and tells you whether it agrees. A check costs a fraction of a cent.
        Get a key at{' '}
        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
          platform.deepseek.com
        </a>
        .
      </Note>

      <Note kind="good" title="Are my keys safe?">
        They are stored only in this browser on this computer, and each one is only ever sent to the
        service it belongs to. Nothing is uploaded anywhere else. To wipe them, use{' '}
        <b>Reset everything</b> at the bottom of the last step.
      </Note>

      <ErrorNote error={error} />

      {result ? (
        <Note
          kind={
            result.gemini === 'ok' &&
            result.elevenlabs === 'ok' &&
            (!deepseekKey.trim() || result.deepseek === 'ok')
              ? 'good'
              : 'warn'
          }
          title="Key check"
        >
          <div>
            <b style={{ display: 'inline' }}>Gemini:</b> {result.gemini === 'ok' ? '✅ working' : '❌ ' + result.gemini}
          </div>
          <div>
            <b style={{ display: 'inline' }}>ElevenLabs:</b>{' '}
            {result.elevenlabs === 'ok' ? '✅ working' : '❌ ' + result.elevenlabs}
          </div>
          {deepseekKey.trim() ? (
            <div>
              <b style={{ display: 'inline' }}>DeepSeek:</b>{' '}
              {result.deepseek === 'ok' ? '✅ working' : '❌ ' + result.deepseek}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>
              <b style={{ display: 'inline' }}>DeepSeek:</b> not set — the answer check is off
            </div>
          )}
          {result.elevenlabsQuota ? (
            <div style={{ marginTop: 6 }}>
              Voice credits left this month: <b style={{ display: 'inline' }}>
                {result.elevenlabsQuota.left.toLocaleString()}
              </b>{' '}
              characters (one video uses roughly 500–900).
            </div>
          ) : null}
        </Note>
      ) : null}

      <div className="actions">
        <button className="btn" onClick={check} disabled={checking || !bothFilled}>
          {checking ? <Spinner /> : null} Test my keys
        </button>
        <div className="spacer" />
        <button className="btn primary" onClick={onNext} disabled={!bothFilled}>
          Continue →
        </button>
      </div>

      {!bothFilled ? (
        <div className="hint" style={{ marginTop: 10, color: 'var(--dim)' }}>
          Paste the Gemini and ElevenLabs keys to continue.
        </div>
      ) : null}
    </div>
  );
};
