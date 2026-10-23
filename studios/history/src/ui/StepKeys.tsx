import React, { useState } from 'react';
import { api, type Keys } from '../lib/api';
import { Note, Spinner, TextInput } from './controls';

export const StepKeys: React.FC<{
  keys: Keys;
  setGemini: (v: string) => void;
  setClaude: (v: string) => void;
  setEleven: (v: string) => void;
  setPexels: (v: string) => void;
  setPixabay: (v: string) => void;
}> = ({ keys, setGemini, setClaude, setEleven, setPexels, setPixabay }) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Record<string, string> | null>(null);

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      setResult(await api.checkKeys());
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  const status = (name: string) => {
    if (!result || !result[name] || result[name] === 'skipped') return null;
    return result[name] === 'ok'
      ? <span className="pill good">works ✓</span>
      : <span className="pill bad" title={result[name]}>problem</span>;
  };

  return (
    <>
      <h2>API keys</h2>
      <p className="lede">
        All optional. Without any keys she can still paste her own script, record her own voice and upload her own pictures.
        Keys stay in this browser and are never saved to disk.
      </p>
      <div className="grid full">
        <div>
          <TextInput
            label="Gemini key — writes scripts (free) and draws pictures (needs billing)"
            hint="Get one at aistudio.google.com/app/apikey. Writing is free; drawing pictures needs billing on the key (~4¢ a picture)."
            value={keys.gemini}
            onChange={setGemini}
            password
            placeholder="AIza…"
          />
          {status('gemini')}
        </div>
        <div>
          <TextInput
            label="Claude key — writes scripts (optional alternative to Gemini)"
            hint="Get one at platform.claude.com. Pick Claude or Gemini as the writer on the Story step."
            value={keys.claude}
            onChange={setClaude}
            password
            placeholder="sk-ant-…"
          />
          {status('claude')}
        </div>
        <div>
          <TextInput
            label="ElevenLabs key — AI voiceover, and exact caption timing for recordings"
            hint="Get one at elevenlabs.io/app/settings/api-keys. Also used to time the captions on clips she records herself."
            value={keys.eleven}
            onChange={setEleven}
            password
            placeholder="sk_…"
          />
          {status('elevenlabs')}
        </div>
        <div>
          <TextInput
            label="Pexels key — free stock photos and videos (optional)"
            hint="Free at pexels.com/api. Wikimedia Commons, Openverse and NASA need no key at all."
            value={keys.pexels}
            onChange={setPexels}
            password
          />
          {status('pexels')}
        </div>
        <div>
          <TextInput
            label="Pixabay key — free stock photos and videos (optional)"
            hint="Free at pixabay.com/api/docs (sign in, the key is shown on that page)."
            value={keys.pixabay}
            onChange={setPixabay}
            password
          />
          {status('pixabay')}
        </div>
      </div>
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" onClick={check} disabled={checking || !(keys.gemini || keys.claude || keys.eleven || keys.pexels || keys.pixabay)}>
          {checking ? <Spinner /> : null} Check keys (free)
        </button>
      </div>
      {result && Object.entries(result).some(([, v]) => v !== 'ok' && v !== 'skipped') ? (
        <Note kind="warn" title="Some keys did not work">
          <ul>
            {Object.entries(result).filter(([, v]) => v !== 'ok' && v !== 'skipped').map(([k, v]) => <li key={k}><b style={{ display: 'inline' }}>{k}:</b> {v}</li>)}
          </ul>
        </Note>
      ) : null}
    </>
  );
};
