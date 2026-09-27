import React, { useState } from 'react';
import { api } from '../lib/api';
import type { QuizContent } from '../lib/types';
import { DEFAULT_DESIGN, getTheme } from '../lib/theme';
import {
  GRAPH_KINDS, GRAPH_LABELS, MAX_CARDS, tidySheet, type FormulaCard, type FormulaSheet, type GraphKind,
} from '../lib/formula-card';
import { formulaSceneAt, withFormulaScene, withoutFormulaScene } from '../lib/script-edit';
import { MathText } from '../remotion/MathText';
import { Check, ErrorNote, Select, Spinner, TextInput } from './controls';

// ---------------------------------------------------------------------------
// The formula card, on the Script step: the formulas the question used, as a
// revision sheet shown near the end of the video and as a carousel slide.
//
// Gemini writes it (text only, free tier); every card stays editable, with
// the formula typeset beside its box as it is typed. Putting it in the video
// adds one scene before the outro - and only that scene needs a voice, since
// the others' clips move along with it (see src/lib/script-edit.ts).
// ---------------------------------------------------------------------------

/** The typeset preview is drawn on the app's own dark panels. */
const PREVIEW_THEME = getTheme({ ...DEFAULT_DESIGN, layout: 'simple', mode: 'dark' });

const blankCard = (): FormulaCard => ({
  name: '',
  formula: '',
  notes: [],
  graph: { kind: 'none', x: '', y: '', label: '', label2: '' },
  icon: '',
});

export const FormulaCardPanel: React.FC<{
  content: QuizContent;
  setContent: (updater: (prev: QuizContent) => QuizContent) => void;
  geminiKey: string;
  geminiModel: string;
  /** A scene was put in at this position: later clips move along one. */
  onSceneInserted: (at: number) => void;
  /** A scene was taken out from this position: its clip goes, later ones move back. */
  onSceneRemoved: (at: number) => void;
}> = ({ content, setContent, geminiKey, geminiModel, onSceneInserted, onSceneRemoved }) => {
  const [busy, setBusy] = useState<'write' | 'icons' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = content.formulas;
  const inVideo = formulaSceneAt(content.script) >= 0;
  const noKey = geminiKey.trim().length < 6;

  const setSheet = (next: FormulaSheet | undefined) => setContent((prev) => ({ ...prev, formulas: next }));

  const showInVideo = (on: boolean) => {
    if (on) {
      const { script, at } = withFormulaScene(content.script);
      if (at < 0) return;
      setContent((prev) => ({ ...prev, script }));
      onSceneInserted(at);
    } else {
      const { script, at } = withoutFormulaScene(content.script);
      if (at < 0) return;
      setContent((prev) => ({ ...prev, script }));
      onSceneRemoved(at);
    }
  };

  const write = async () => {
    setBusy('write');
    setError(null);
    try {
      const out = await api.formulas({ apiKey: geminiKey, model: geminiModel || 'gemini-2.5-flash', content });
      setSheet(out.sheet);
      // The first card written goes straight into the video: that is what it is for.
      if (!sheet && !inVideo) showInVideo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const findIcons = async () => {
    if (!sheet) return;
    setBusy('icons');
    setError(null);
    try {
      const out = await api.formulaIcons(sheet);
      setSheet(out.sheet);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const editCard = (i: number, patch: Partial<FormulaCard>) => {
    if (!sheet) return;
    setSheet({ ...sheet, cards: sheet.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  };
  const editGraph = (i: number, patch: Partial<FormulaCard['graph']>) => {
    if (!sheet) return;
    editCard(i, { graph: { ...sheet.cards[i].graph, ...patch } });
  };
  const removeCard = (i: number) => {
    if (!sheet) return;
    const cards = sheet.cards.filter((_, j) => j !== i);
    if (cards.length) {
      setSheet({ ...sheet, cards });
      return;
    }
    // The last card gone: no sheet, and no empty scene left in the video.
    setSheet(undefined);
    if (inVideo) showInVideo(false);
  };
  const addCard = () => {
    const base = sheet || { title: [content.topic, 'Important Formulas'].filter(Boolean).join(' - '), cards: [] };
    setSheet({ ...base, cards: [...base.cards, blankCard()] });
  };

  const missingIcons = sheet ? sheet.cards.some((c) => c.icon.trim() && !c.art) : false;
  // What the video and the carousel will actually use, after the same checks the server makes.
  const usable = tidySheet(sheet);
  const dropped = sheet && usable ? sheet.cards.length - usable.cards.length : 0;

  return (
    <div className="formula-panel">
      <p className="hint">
        Every formula the question uses, as a revision sheet: shown near the end of the video — the
        waveforms and diagrams drawn in and moving — and as a slide in the carousel. Gemini writes it from
        the question and its working; edit anything afterwards.
      </p>

      <ErrorNote error={error} />

      <div className="actions">
        <button className="btn" disabled={noKey || busy !== null} onClick={write} title={noKey ? 'Add your Gemini key on the Keys step' : ''}>
          {busy === 'write' ? <><Spinner /> Writing the formula card…</> : sheet ? 'Write it again' : 'Write the formula card'}
        </button>
        {!sheet ? <button className="btn ghost" disabled={busy !== null} onClick={addCard}>Start one by hand</button> : null}
        {missingIcons ? (
          <button className="btn ghost" disabled={busy !== null} onClick={findIcons}>
            {busy === 'icons' ? <Spinner /> : null} Find the icons
          </button>
        ) : null}
      </div>

      {sheet ? (
        <>
          <Check
            label="Show it at the end of the video"
            hint={
              'Adds one scene before the outro, held long enough to read every card. '
              + (inVideo ? 'Its spoken line is in the script below.' : 'Only that scene needs a voice; the rest keep theirs.')
            }
            checked={inVideo}
            onChange={showInVideo}
          />
          <TextInput label="Title" value={sheet.title} onChange={(v) => setSheet({ ...sheet, title: v })} />
          {dropped > 0 ? (
            <p className="hint">{dropped} card{dropped > 1 ? 's have' : ' has'} no formula yet and will be left out.</p>
          ) : null}

          <div className="formula-cards">
            {sheet.cards.map((card, i) => (
              <div className="formula-card-edit" key={i}>
                <div className="formula-card-head">
                  <b>{i + 1}.</b>
                  <span className="formula-preview">
                    {card.formula.trim() ? <MathText theme={PREVIEW_THEME} src={card.formula} size={26} /> : <em>no formula yet</em>}
                  </span>
                  <span className="spacer" />
                  <button className="btn small ghost" onClick={() => removeCard(i)} title="Remove this card">✕</button>
                </div>
                <div className="grid">
                  <TextInput label="Name" value={card.name} onChange={(v) => editCard(i, { name: v })} />
                  <TextInput
                    label="Formula"
                    hint="LaTeX: V_{rms} = \frac{V_0}{\sqrt{2}}, \omega, \phi, \cos"
                    value={card.formula}
                    onChange={(v) => editCard(i, { formula: v })}
                  />
                  {/* Kept as typed, blanks and all; the sheet drops empty notes when it is drawn. */}
                  <TextInput label="Note 1" placeholder="f = Frequency (Hz)" value={card.notes[0] || ''}
                    onChange={(v) => editCard(i, { notes: [v, card.notes[1] || ''] })} />
                  <TextInput label="Note 2" value={card.notes[1] || ''}
                    onChange={(v) => editCard(i, { notes: [card.notes[0] || '', v] })} />
                  <Select
                    label="Graph"
                    value={card.graph.kind}
                    options={GRAPH_KINDS.map((k) => ({ id: k, label: GRAPH_LABELS[k] }))}
                    onChange={(v) => editGraph(i, { kind: v as GraphKind })}
                  />
                  <TextInput
                    label="Icon"
                    hint="A thing: light bulb, ammeter, gear"
                    value={card.icon}
                    // A new noun needs a new drawing: "Find the icons" looks it up.
                    onChange={(v) => editCard(i, { icon: v, art: undefined })}
                  />
                  {card.graph.kind !== 'none' ? (
                    <>
                      <TextInput label="Graph label" placeholder="V_0" value={card.graph.label} onChange={(v) => editGraph(i, { label: v })} />
                      <TextInput label="Second label" value={card.graph.label2} onChange={(v) => editGraph(i, { label2: v })} />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {sheet.cards.length < MAX_CARDS ? (
            <button className="btn ghost small" onClick={addCard}>+ Add a formula</button>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
