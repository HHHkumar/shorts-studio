// Editing a data graphic: its kind, title and the data it draws.

import React from 'react';
import { DISPUTED_BORDERS, findCountry } from '../remotion/graphics/WorldMap';
import { GRAPHIC_KINDS, type Graphic, type GraphicKind } from '../lib/types';
import { Note } from './controls';

const ITEM_LABELS: Partial<Record<GraphicKind, [string, string | null, string | null]>> = {
  bars: ['Label', 'Value', null],
  line: ['Year / date', 'Value', null],
  people: ['Name', null, 'Role and position'],
  timeline: ['Date', null, 'What happened'],
  number: ['(optional)', null, 'Small caption under the number'],
};

const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);

export const GraphicEditor: React.FC<{ g: Graphic; onChange: (g: Graphic) => void }> = ({ g, onChange }) => {
  const set = (patch: Partial<Graphic>) => onChange({ ...g, ...patch });
  const cols = ITEM_LABELS[g.kind];
  const unknown = g.kind === 'map' ? g.countries.filter((c) => !findCountry(c)) : [];
  const disputed = g.kind === 'map' && g.countries.some((c) => DISPUTED_BORDERS.includes(findCountry(c)?.properties.name || ''));

  return (
    <div className="graphic-editor">
      <div className="row" style={{ marginTop: 0 }}>
        <select value={g.kind} onChange={(e) => set({ kind: e.target.value as GraphicKind })}>
          {GRAPHIC_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <span className="stat">{GRAPHIC_KINDS.find((k) => k.id === g.kind)?.hint}</span>
      </div>
      <input className="text full" value={g.title} placeholder={g.kind === 'headline' ? 'The headline' : 'Title on screen (optional)'} onChange={(e) => set({ title: e.target.value })} />

      {g.kind === 'headline' ? (
        <div className="row">
          <input className="text" value={g.role} placeholder="Kicker, e.g. Explained · 6 Oct" onChange={(e) => set({ role: e.target.value })} />
          <input className="text" value={g.quote} placeholder="One-line subheading (optional)" onChange={(e) => set({ quote: e.target.value })} />
        </div>
      ) : null}

      {g.kind === 'number' ? (
        <div className="row">
          <label className="numbox">from <input type="number" value={g.from} onChange={(e) => set({ from: Number(e.target.value) })} /></label>
          <label className="numbox">to <input type="number" value={g.value} onChange={(e) => set({ value: Number(e.target.value) })} /></label>
          <input className="unit" value={g.unit} placeholder="unit" onChange={(e) => set({ unit: e.target.value })} />
        </div>
      ) : null}

      {g.kind === 'quote' ? (
        <>
          <textarea value={g.quote} placeholder="The exact words, as reported" onChange={(e) => set({ quote: e.target.value })} />
          <div className="row">
            <input className="text" value={g.who} placeholder="Who said it" onChange={(e) => set({ who: e.target.value })} />
            <input className="text" value={g.role} placeholder="Their role" onChange={(e) => set({ role: e.target.value })} />
          </div>
        </>
      ) : null}

      {g.kind === 'map' ? (
        <>
          <input className="text full" value={g.countries.join(', ')} placeholder="Countries to highlight, comma separated: India, France, Germany"
            onChange={(e) => set({ countries: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          {unknown.length ? <p className="stat bad">Not found on the map: {unknown.join(', ')}. Try the common English name.</p> : null}
          {disputed ? (
            <Note kind="warn">
              Map borders follow Natural Earth’s de facto lines, which differ from the official maps of India, Pakistan and China
              (for example in Kashmir). For a map of India, consider uploading an official map image as a picture instead.
            </Note>
          ) : null}
        </>
      ) : null}

      {g.kind === 'versus' ? (
        <div className="versus-edit">
          {(['left', 'right'] as const).map((side) => (
            <div key={side}>
              <input className="text full" value={g[side].title} placeholder={side === 'left' ? 'First side' : 'Other side'}
                onChange={(e) => set({ [side]: { ...g[side], title: e.target.value } } as Partial<Graphic>)} />
              <textarea value={g[side].points.join('\n')} placeholder="One point per line (2–4)"
                onChange={(e) => set({ [side]: { ...g[side], points: lines(e.target.value).slice(0, 4) } } as Partial<Graphic>)} />
            </div>
          ))}
        </div>
      ) : null}

      {cols ? (
        <>
          <table className="items">
            <thead>
              <tr>
                <th>{cols[0]}</th>
                {cols[1] ? <th>{cols[1]}</th> : null}
                {cols[2] ? <th>{cols[2]}</th> : null}
                <th />
              </tr>
            </thead>
            <tbody>
              {g.items.map((it, i) => (
                <tr key={i}>
                  <td><input value={it.label} onChange={(e) => set({ items: g.items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></td>
                  {cols[1] ? <td><input type="number" value={it.value} onChange={(e) => set({ items: g.items.map((x, k) => (k === i ? { ...x, value: Number(e.target.value) } : x)) })} /></td> : null}
                  {cols[2] ? <td><input value={it.note} onChange={(e) => set({ items: g.items.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)) })} /></td> : null}
                  <td><button className="icon-btn" onClick={() => set({ items: g.items.filter((_, k) => k !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <button className="btn small" onClick={() => set({ items: [...g.items, { label: '', value: 0, note: '' }] })}>＋ Row</button>
            {g.kind === 'bars' || g.kind === 'line' ? <input className="unit" value={g.unit} placeholder="unit" onChange={(e) => set({ unit: e.target.value })} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
};
