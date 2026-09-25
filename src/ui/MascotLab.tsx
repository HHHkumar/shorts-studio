import React, { useEffect, useState } from 'react';
import { api, type Mascot, type MascotDrawing, type MascotLabInfo } from '../lib/api';
import { ErrorNote, Note, Select, Spinner } from './controls';

// ---------------------------------------------------------------------------
// The mascot lab: design the doodle engineer once, then check it holds.
//
// Two jobs, in order. First draw one design per direction and adopt one as the
// model sheet - that file is committed, so it is the same engineer on every
// machine. Then draw six scenes against it and judge, side by side, whether
// the character survives puzzled, zapped and triumphant as well as calm.
//
// Deliberately bare. This is the test that decides whether the doodle look is
// worth building properly; the real controls come after it passes.
//
// The Gemini key comes in as a prop from the app's own state and goes straight
// to the local helper, the same path as every other Draw button.
// ---------------------------------------------------------------------------

type Props = { geminiKey: string; onClose: () => void };

const DESIGN_MODEL = 'gemini-3-pro-image';
const TEST_MODEL = 'gemini-3.1-flash-image';

export const MascotLab: React.FC<Props> = ({ geminiKey, onClose }) => {
  const [info, setInfo] = useState<MascotLabInfo | null>(null);
  const [mascot, setMascot] = useState<Mascot | null>(null);
  const [designModel, setDesignModel] = useState(DESIGN_MODEL);
  const [testModel, setTestModel] = useState(TEST_MODEL);
  const [designs, setDesigns] = useState<{ model: string; results: MascotDrawing[] } | null>(null);
  const [scenes, setScenes] = useState<{ model: string; results: MascotDrawing[] } | null>(null);
  const [busy, setBusy] = useState<'' | 'design' | 'adopt' | 'test'>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.mascotLab()
      .then((i) => { setInfo(i); setMascot(i.mascot); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // The price is shown only once it is known. "~0c" on a button that spends
  // real money would be worse than saying nothing.
  const priceFor = (id: string, count: number) => {
    const model = info && info.models.find((m) => m.id === id);
    return model ? ' (~' + model.cents * count + 'c)' : '';
  };

  const run = async <T,>(kind: 'design' | 'adopt' | 'test', job: () => Promise<T>) => {
    setBusy(kind);
    setError(null);
    try {
      return await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy('');
    }
  };

  const drawDesigns = async () => {
    const out = await run('design', () => api.mascotDesign({ apiKey: geminiKey, modelId: designModel }));
    if (out) setDesigns(out);
  };

  const adopt = async (d: MascotDrawing) => {
    if (!d.src || !designs) return;
    const out = await run('adopt', () => api.mascotAdopt({ src: d.src!, variant: d.id, modelId: designs.model }));
    if (out) { setMascot(out.mascot); setScenes(null); }
  };

  const drawScenes = async () => {
    const out = await run('test', () => api.mascotTest({ apiKey: geminiKey, modelId: testModel }));
    if (out) setScenes(out);
  };

  const variantCount = info ? info.variants.length : 4;
  const beatCount = info ? info.beats.length : 6;
  const noKey = geminiKey.trim().length < 6;
  const dropped = scenes ? scenes.results.filter((s) => s.src && s.referenced === false).length : 0;

  return (
    <div className="panel mascot-lab">
      <div className="mascot-top">
        <h2>Mascot lab</h2>
        <button className="btn ghost small" onClick={onClose}>Back to the video</button>
      </div>
      <p className="lede">
        One doodle engineer, drawn the same way in every video. Design it once, adopt the one you
        like, then test whether it stays the same character across six very different scenes.
      </p>

      {noKey ? (
        <Note kind="warn" title="No Gemini key yet">Add it on the Keys step — every drawing here uses it.</Note>
      ) : null}
      <ErrorNote error={error} />

      {/* --- 1. the model sheet ------------------------------------------------ */}
      <div className="section-title">1 · The mascot</div>
      {mascot ? (
        <div className="mascot-current">
          <img src={'/' + mascot.src + '?v=' + encodeURIComponent(mascot.adoptedAt)} alt="The adopted mascot" />
          <div>
            <b>{mascot.label}</b>
            <p className="hint">
              This is the model sheet. Every scene is drawn against it, and it lives in{' '}
              <span className="kbd">public/mascot/</span> so it is committed with the code.
            </p>
          </div>
        </div>
      ) : (
        <p className="hint">No mascot adopted yet. Draw the designs, then pick one.</p>
      )}

      <div className="mascot-row">
        <Select
          label="Model for the designs"
          hint="Drawn once and kept for good, so the best model is worth it."
          value={designModel}
          options={info ? info.models.map((m) => ({ id: m.id, label: m.label })) : [DESIGN_MODEL]}
          onChange={setDesignModel}
          disabled={busy !== ''}
        />
        <button className="btn primary" disabled={noKey || busy !== ''} onClick={drawDesigns}>
          {busy === 'design' ? <><Spinner /> Drawing {variantCount} designs…</> : (mascot ? 'Redesign' : 'Draw ' + variantCount + ' designs')
            + priceFor(designModel, variantCount)}
        </button>
      </div>
      {busy === 'design' ? <p className="hint">About a minute — one drawing at a time.</p> : null}

      {designs ? (
        <div className="compare-grid mascot-grid">
          {designs.results.map((d) => (
            <div className="compare-cell" key={d.id}>
              {d.src ? (
                <button className="compare-shot" disabled={busy !== ''} onClick={() => adopt(d)} title="Make this the mascot">
                  <img src={'/' + d.src} alt={d.label} />
                </button>
              ) : (
                <div className="compare-failed">{d.error}</div>
              )}
              <div className="compare-meta">
                <b>{d.label}</b>
                <span>{d.src ? (mascot && mascot.variant === d.id ? 'Adopted ✓' : 'Click to adopt') : 'Failed'} · {d.seconds}s</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* --- 2. the consistency test ---------------------------------------- */}
      <div className="section-title">2 · Does it hold?</div>
      <p className="hint">
        Six beats of one question — puzzled, alarmed, thinking, zapped, got it, teaching. The same
        engineer should be obvious in all six: the round head, the hat with the red bolt, the dot eyes.
      </p>
      <div className="mascot-row">
        <Select
          label="Model for the scenes"
          hint="Flash is documented as the best at matching a reference."
          value={testModel}
          options={info ? info.models.map((m) => ({ id: m.id, label: m.label })) : [TEST_MODEL]}
          onChange={setTestModel}
          disabled={busy !== ''}
        />
        <button className="btn primary" disabled={noKey || !mascot || busy !== ''} onClick={drawScenes}>
          {busy === 'test' ? <><Spinner /> Drawing {beatCount} scenes…</> : 'Draw ' + beatCount + ' test scenes' + priceFor(testModel, beatCount)}
        </button>
      </div>
      {busy === 'test' ? <p className="hint">One to two minutes — every scene is drawn against the model sheet.</p> : null}

      {dropped ? (
        <Note kind="warn" title={dropped + ' drawn without the model sheet'}>
          That model refused the reference image, so those scenes are the character from the written
          description alone. They are marked below — judge the rest.
        </Note>
      ) : null}

      {scenes ? (
        <div className="compare-grid mascot-grid six">
          {scenes.results.map((s) => (
            <div className="compare-cell" key={s.id}>
              {s.src ? (
                <a className="compare-shot" href={'/' + s.src} target="_blank" rel="noreferrer">
                  <img src={'/' + s.src} alt={s.label} />
                </a>
              ) : (
                <div className="compare-failed">{s.error}</div>
              )}
              <div className="compare-meta">
                <b>{s.label}</b>
                <span>{s.src ? (s.referenced === false ? 'No model sheet ⚠' : 'Against the sheet') : 'Failed'} · {s.seconds}s</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
