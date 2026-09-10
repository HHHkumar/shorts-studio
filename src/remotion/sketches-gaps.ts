import type { SketchDef } from './sketches';
import {
  arcArrow, arrow, axes, bars, box, bubble, caption, clean, curve, junction, labels, num,
  safe, setDash, spread, stagger, tint, title, values, wire,
} from './sketch-parts';

// ---------------------------------------------------------------------------
// The last of the empty areas.
//
// Written straight off tools/sketch-coverage.mjs --gaps, which lists every
// sub-topic in the app with no candidate diagram at all. Each entry below
// closes one or more named gaps; nothing here was added because it seemed like
// a good idea.
//
// Run the report after editing. The number that matters is `with nothing`.
// ---------------------------------------------------------------------------

const wide = (
  label: string, describe: string, uses: string, draw: SketchDef['draw'],
): SketchDef => ({ shape: 'wide', label, describe, uses, draw });

const square = (
  label: string, describe: string, uses: string, draw: SketchDef['draw'],
): SketchDef => ({ shape: 'square', label, describe, uses, draw });

export const GAP_SKETCHES: Record<string, SketchDef> = {

  // --- electrical --------------------------------------------------------
  kirchhoff: square('Kirchhoff at a node',
    'currents meeting at a junction, in equalling out. Use for: Kirchhoff current law, node analysis, current division',
    'items (2-4 branch labels with values)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 4);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      const list = vs.length ? vs : [{ label: 'I1', value: 3 }, { label: 'I2', value: 2 }, { label: 'I3', value: 5 }];
      list.forEach((v, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const a = (i / safe(list.length)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const into = i < list.length - 1;
        if (into) arrow(p, x, y, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, colors.accent, 5);
        else arrow(p, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, x, y, colors.good, 5);
        caption(p, v.label + ' = ' + v.value, x, y + (Math.sin(a) > 0 ? 30 : -30), colors, 19);
      });
      junction(p, cx, cy, colors.text, 22);
      caption(p, 'In = Out', cx, height * 0.92, colors, 24);
    }),

  'capacitor-field': wide('Charged plates',
    'two plates with a field between them. Use for: electrostatics, capacitors, dielectrics, insulation strength',
    'labelA (what is between the plates)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.5;
      const h = height * 0.42;
      const l = width * 0.34;
      const r = width * 0.66;
      p.push();
      p.noStroke();
      p.fill('#ff6b6b');
      p.rect(l - 12, cy - h / 2, 24, h, 4);
      p.fill('#5aa9e6');
      p.rect(r - 12, cy - h / 2, 24, h, 4);
      p.pop();
      for (let i = 0; i < 5; i++) {
        const on = stagger(progress, i, 0.08);
        if (on <= 0) continue;
        const y = cy - h / 2 + (h / 6) * (i + 1);
        arrow(p, l + 16, y, l + 16 + (r - l - 32) * on, y, colors.accent, 3, 11);
      }
      caption(p, '+', l - 40, cy, colors, 34);
      caption(p, '−', r + 40, cy, colors, 34);
      caption(p, clean(params.labelA, 18) || 'Dielectric', width / 2, cy + h / 2 + 34, colors, 20);
    }),

  'rms-value': wide('RMS',
    'an alternating wave and the steady value that does the same work. Use for: RMS, average value, AC fundamentals, peak factor',
    'frequency (1-4)',
    ({ p, time, width, height, params, colors }) => {
      const f = num(params.frequency, 2, 1, 4);
      const cy = height / 2;
      const amp = height * 0.3;
      p.push();
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.beginShape();
      for (let x = 0; x <= width; x += 4) {
        p.vertex(x, cy - Math.sin((x / safe(width)) * Math.PI * 2 * f - time * 2) * amp);
      }
      p.endShape();
      p.pop();
      setDash(p, true);
      wire(p, 0, cy - amp * 0.707, width, cy - amp * 0.707, colors.good, 4);
      setDash(p, false);
      wire(p, 0, cy, width, cy, colors.dim, 2);
      caption(p, 'RMS = 0.707 × peak', width * 0.72, cy - amp * 0.707 - 26, colors, 20);
    }),

  'dc-generator': square('Generator',
    'a coil turning in a field, producing a voltage. Use for: generators, alternators, induced emf, Faraday',
    'speed (1-5)',
    ({ p, time, width, height, params, colors }) => {
      const speed = num(params.speed, 3, 1, 5);
      const cx = width / 2;
      const cy = height * 0.44;
      const r = Math.min(width, height) * 0.24;
      p.push();
      p.noStroke();
      p.fill(tint(p, '#ff6b6b', 80));
      p.rect(cx - r * 2, cy - r, r * 0.6, r * 2, 8);
      p.fill(tint(p, '#5aa9e6', 80));
      p.rect(cx + r * 1.4, cy - r, r * 0.6, r * 2, 8);
      p.pop();
      caption(p, 'N', cx - r * 1.7, cy, colors, 28);
      caption(p, 'S', cx + r * 1.7, cy, colors, 28);
      p.push();
      p.translate(cx, cy);
      p.rotate(time * speed * 0.6);
      p.noFill();
      p.stroke(colors.accent);
      p.strokeWeight(6);
      p.rect(-r * 0.7, -r * 0.45, r * 1.4, r * 0.9, 5);
      p.pop();
      const v = Math.sin(time * speed * 0.6) * height * 0.1;
      wire(p, cx - 40, height * 0.86, cx + 40, height * 0.86 - v, colors.good, 5);
      caption(p, 'Induced emf', cx, height * 0.95, colors, 20);
    }),

  'stepper-motor': square('Stepper motor',
    'a rotor stepping between fixed positions. Use for: stepper motors, servos, positioning, special machines',
    'count (4-8 steps)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 6, 4, 8));
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      for (let i = 0; i < n; i++) {
        const a = (i / safe(n)) * Math.PI * 2 - Math.PI / 2;
        junction(p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, tint(p, colors.dim, 150), 20);
      }
      const step = Math.floor(progress * n) % n;
      const a = (step / safe(n)) * Math.PI * 2 - Math.PI / 2;
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(8);
      p.line(cx, cy, cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      p.pop();
      junction(p, cx, cy, colors.text, 16);
      caption(p, 'Step ' + (step + 1) + ' of ' + n, cx, height * 0.92, colors, 22);
    }),

  oscilloscope: wide('Oscilloscope',
    'a trace on a gridded screen. Use for: oscilloscopes, waveforms, measurement, signal shape',
    'frequency (1-5), mode ("sine" or "square")',
    ({ p, time, width, height, params, colors }) => {
      const f = num(params.frequency, 2, 1, 5);
      const sq = String(params.mode || 'sine') === 'square';
      const ox = width * 0.1;
      const oy = height * 0.16;
      const w = width * 0.8;
      const h = height * 0.62;
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(5);
      p.fill(tint(p, '#000000', 200));
      p.rect(ox, oy, w, h, 8);
      p.stroke(tint(p, colors.dim, 70));
      p.strokeWeight(1);
      for (let i = 1; i < 8; i++) {
        p.line(ox + (w / 8) * i, oy, ox + (w / 8) * i, oy + h);
        p.line(ox, oy + (h / 6) * i, ox + w, oy + (h / 6) * i);
      }
      p.noFill();
      p.stroke(colors.good);
      p.strokeWeight(4);
      p.beginShape();
      for (let x = 0; x <= w; x += 3) {
        const a = (x / safe(w)) * Math.PI * 2 * f - time * 2;
        const v = sq ? Math.sign(Math.sin(a)) : Math.sin(a);
        p.vertex(ox + x, oy + h / 2 - v * h * 0.34);
      }
      p.endShape();
      p.pop();
    }),

  'sensor-chain': wide('Sensor to reading',
    'a quantity turned into a signal and then a number. Use for: transducers, sensors, instrumentation, calibration',
    'items (up to 3 stage labels), labelA (what is measured)',
    ({ p, progress, width, height, params, items, colors }) => {
      const names = labels(items, 3);
      const stages = [names[0] || 'Sensor', names[1] || 'Amplifier', names[2] || 'Display'];
      const xs = spread(3, width * 0.24, width * 0.82);
      const cy = height * 0.46;
      caption(p, clean(params.labelA, 14) || 'Heat', width * 0.08, cy, colors, 22);
      arrow(p, width * 0.13, cy, xs[0] - width * 0.08, cy, colors.accent, 4);
      stages.forEach((s, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        box(p, xs[i], cy, width * 0.16, height * 0.22, s, colors, { lit: i === 2 });
        if (i > 0 && stagger(progress, i - 1, 0.16) > 0.9) {
          arrow(p, xs[i - 1] + width * 0.08, cy, xs[i] - width * 0.08, cy, colors.dim, 4);
        }
      });
    }),

  'material-bands': wide('Conductors and insulators',
    'the energy gap in a conductor, semiconductor and insulator. Use for: semiconductors, insulating materials, band gap, conduction',
    'mode ("all", "conductor", "semiconductor", "insulator")',
    ({ p, progress, width, height, params, colors }) => {
      const which = String(params.mode || 'all');
      const kinds = which === 'all' ? ['conductor', 'semiconductor', 'insulator'] : [which];
      const gaps: Record<string, number> = { conductor: 0, semiconductor: 0.16, insulator: 0.4 };
      const xs = spread(kinds.length, width * 0.22, width * 0.78);
      kinds.forEach((k, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const gap = gaps[k] ?? 0.2;
        const w = Math.min(width / safe(kinds.length) * 0.5, 170);
        const cy = height * 0.46;
        const band = height * 0.16;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 190));
        p.rect(xs[i] - w / 2, cy + gap * height * 0.5, w, band, 4);
        p.fill(tint(p, colors.dim, 150));
        p.rect(xs[i] - w / 2, cy - band - gap * height * 0.5, w, band, 4);
        p.pop();
        caption(p, k, xs[i], height * 0.86, colors, 19);
        if (gap > 0.02) caption(p, 'gap', xs[i], cy, colors, 17);
      });
    }),

  superconductor: wide('Superconductor',
    'resistance falling to nothing below a critical temperature. Use for: superconductors, critical temperature, zero resistance',
    'ratio (0.2-0.7, where it drops)',
    ({ p, progress, width, height, params, colors }) => {
      const tc = num(params.ratio, 0.4, 0.2, 0.7);
      const plot = axes(p, width, height, colors, { x: 'Temperature', y: 'Resistance' });
      curve(p, plot, (t) => (t < tc ? 0 : (t - tc) * 1.4), colors.accent, progress);
      setDash(p, true);
      wire(p, plot.x(tc), plot.bottom, plot.x(tc), plot.top, colors.dim, 2);
      setDash(p, false);
      caption(p, 'Tc', plot.x(tc), plot.bottom + 26, colors, 20);
    }),

  // --- physics -----------------------------------------------------------
  'newton-laws': wide('Force and acceleration',
    'a push producing acceleration against a mass. Use for: Newton laws, F = ma, inertia, action and reaction',
    'ratio (0.5-3, the mass), labelA (the force)',
    ({ p, progress, width, height, params, colors }) => {
      const m = num(params.ratio, 1, 0.5, 3);
      const cy = height * 0.5;
      const size = 50 + m * 26;
      const x = width * 0.3 + (progress * progress) * width * 0.34 / safe(m);
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.rect(x - size / 2, cy - size / 2, size, size, 8);
      p.pop();
      title(p, 'm', x, cy, colors, 26);
      arrow(p, x - size / 2 - 90, cy, x - size / 2 - 8, cy, colors.good, 6, 18);
      caption(p, clean(params.labelA, 10) || 'F', x - size / 2 - 50, cy - 34, colors, 22);
      caption(p, 'a = F / m', width / 2, height * 0.88, colors, 26);
    }),

  'nuclear-decay': wide('Radioactive decay',
    'a sample halving again and again. Use for: half life, radioactivity, nuclear physics, decay curves',
    'count (2-5 half lives)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 3, 2, 5));
      const plot = axes(p, width, height, colors, { x: 'Time', y: 'Amount' });
      curve(p, plot, (t) => Math.pow(0.5, t * n) * 0.9, colors.accent, progress);
      for (let i = 1; i <= n; i++) {
        const t = i / safe(n);
        if (progress < t * 0.9) continue;
        setDash(p, true);
        wire(p, plot.x(t), plot.bottom, plot.x(t), plot.y(Math.pow(0.5, i) * 0.9), colors.dim, 2);
        setDash(p, false);
        caption(p, i + ' half life' + (i > 1 ? 's' : ''), plot.x(t), plot.bottom + 26, colors, 17);
      }
    }),

  'energy-levels': square('Energy levels',
    'electron shells as rungs, with a jump between them. Use for: quantum, spectra, photon emission, atomic energy levels',
    'count (3-5 levels)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 3, 5));
      const left = width * 0.24;
      const right = width * 0.76;
      for (let i = 0; i < n; i++) {
        // Squeezed together higher up, which is the shape of a real spectrum.
        const y = height * 0.82 - Math.pow(i / safe(n - 1), 0.6) * height * 0.6;
        wire(p, left, y, right, y, colors.dim, 4);
        caption(p, 'n=' + (i + 1), left - 40, y, colors, 19);
      }
      const from = height * 0.82 - Math.pow(2 / safe(n - 1), 0.6) * height * 0.6;
      const to = height * 0.82;
      const t = Math.min(1, progress * 1.6);
      arrow(p, width / 2, from, width / 2, from + (to - from) * t, colors.accent, 5);
      if (t > 0.9) caption(p, 'photon out', width * 0.66, (from + to) / 2, colors, 19);
    }),

  'carnot-cycle': wide('Heat engine',
    'heat taken in, work out, the rest rejected. Use for: thermodynamics, engines, efficiency, Carnot',
    'ratio (0.2-0.6, the efficiency)',
    ({ p, progress, width, height, params, colors }) => {
      const eff = num(params.ratio, 0.35, 0.2, 0.6);
      const cx = width / 2;
      const cy = height * 0.5;
      box(p, cx, cy, width * 0.22, height * 0.3, 'Engine', colors, { lit: true });
      box(p, cx, height * 0.14, width * 0.3, height * 0.16, 'Hot', colors);
      box(p, cx, height * 0.86, width * 0.3, height * 0.16, 'Cold', colors);
      if (progress > 0.2) arrow(p, cx, height * 0.22, cx, cy - height * 0.15, '#ff6b6b', 6);
      if (progress > 0.5) arrow(p, cx + width * 0.11, cy, cx + width * 0.3, cy, colors.good, 6);
      if (progress > 0.7) arrow(p, cx, cy + height * 0.15, cx, height * 0.78, '#5aa9e6', 5);
      caption(p, 'Work ' + Math.round(eff * 100) + '%', cx + width * 0.3, cy - 30, colors, 20);
    }),

  magnetism: wide('Magnetic field',
    'field lines looping from one pole to the other. Use for: magnetism, magnetic fields, poles, electromagnets',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const cx = width / 2;
      const cy = height * 0.5;
      const w = width * 0.2;
      p.push();
      p.noStroke();
      p.fill('#ff6b6b');
      p.rect(cx - w, cy - 34, w, 68, 4);
      p.fill('#5aa9e6');
      p.rect(cx, cy - 34, w, 68, 4);
      p.pop();
      caption(p, 'N', cx - w / 2, cy, colors, 28);
      caption(p, 'S', cx + w / 2, cy, colors, 28);
      for (let i = 1; i <= 4; i++) {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) continue;
        const rx = w * (0.6 + i * 0.5);
        const ry = 40 + i * 42;
        p.push();
        p.noFill();
        p.stroke(tint(p, colors.accent, 200 - i * 26));
        p.strokeWeight(3);
        p.ellipse(cx, cy, rx * 2, ry * 2);
        p.pop();
      }
    }),

  // --- chemistry ---------------------------------------------------------
  mole: wide('Moles',
    'mass converted to moles and then to particles. Use for: stoichiometry, moles, Avogadro, formula mass',
    'labelA (the substance)',
    ({ p, progress, width, height, params, colors }) => {
      const xs = spread(3, width * 0.2, width * 0.8);
      const cy = height * 0.46;
      ['Mass', 'Moles', 'Particles'].forEach((s, i) => {
        const on = stagger(progress, i, 0.18);
        if (on <= 0) return;
        box(p, xs[i], cy, width * 0.2, height * 0.24, s, colors, { lit: i === 1 });
        if (i > 0 && stagger(progress, i - 1, 0.18) > 0.9) {
          arrow(p, xs[i - 1] + width * 0.1, cy, xs[i] - width * 0.1, cy, colors.accent, 4);
        }
      });
      caption(p, '÷ formula mass', (xs[0] + xs[1]) / 2, cy - height * 0.2, colors, 18);
      caption(p, '× 6.02×10²³', (xs[1] + xs[2]) / 2, cy - height * 0.2, colors, 18);
      caption(p, clean(params.labelA, 16), width / 2, height * 0.88, colors, 20);
    }),

  redox: wide('Redox',
    'electrons moving from one species to the other. Use for: redox, oxidation and reduction, electrochemistry',
    'labelA (loses electrons), labelB (gains them)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.46;
      bubble(p, width * 0.26, cy, 66, clean(params.labelA, 6) || 'A', colors, { lit: true, size: 26 });
      bubble(p, width * 0.74, cy, 66, clean(params.labelB, 6) || 'B', colors, { size: 26 });
      for (let i = 0; i < 3; i++) {
        const t = Math.min(1, Math.max(0, progress * 1.6 - i * 0.16));
        if (t <= 0) continue;
        const x = width * 0.34 + (width * 0.32) * t;
        p.push();
        p.noStroke();
        p.fill(colors.good);
        p.circle(x, cy - 40 + i * 40, 16);
        p.pop();
      }
      caption(p, 'Oxidised — loses', width * 0.26, cy + 100, colors, 19);
      caption(p, 'Reduced — gains', width * 0.74, cy + 100, colors, 19);
    }),

  'organic-chain': wide('Carbon chain',
    'carbon atoms in a chain with their bonds. Use for: organic chemistry, hydrocarbons, polymers, functional groups',
    'count (2-6 carbons), mode ("single" or "double")',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 2, 6));
      const dbl = String(params.mode || 'single') === 'double';
      const xs = spread(n, width * 0.2, width * 0.8);
      const cy = height * 0.48;
      xs.forEach((x, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        if (i > 0) {
          const y1 = cy;
          wire(p, xs[i - 1] + 26, y1, x - 26, y1, colors.text, 4);
          if (dbl && i === 1) wire(p, xs[i - 1] + 26, y1 + 12, x - 26, y1 + 12, colors.text, 4);
        }
        bubble(p, x, cy + (i % 2 ? 26 : -26), 26 * on, 'C', colors, { size: 20 });
      });
      caption(p, dbl ? 'A double bond makes it unsaturated' : 'All single bonds — saturated',
              width / 2, height * 0.88, colors, 20);
    }),

  // --- biology -----------------------------------------------------------
  respiration: wide('Respiration',
    'glucose and oxygen going in, energy and waste out. Use for: respiration, metabolism, ATP, energy release',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const cx = width / 2;
      const cy = height * 0.48;
      bubble(p, cx, cy, Math.min(width, height) * 0.18, 'Cell', colors, { lit: true, size: 24 });
      [['Glucose', -1], ['Oxygen', 1]].forEach(([t, s], i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        const y = cy + Number(s) * height * 0.22;
        arrow(p, width * 0.1, y, cx - width * 0.12, cy + Number(s) * 20, colors.accent, 4);
        caption(p, String(t), width * 0.14, y - 26, colors, 19);
      });
      [['ATP', -1], ['CO₂ + water', 1]].forEach(([t, s], i) => {
        const on = stagger(progress, i + 2, 0.12);
        if (on <= 0) return;
        const y = cy + Number(s) * height * 0.22;
        arrow(p, cx + width * 0.12, cy + Number(s) * 20, width * 0.9, y, colors.good, 4);
        caption(p, String(t), width * 0.86, y - 26, colors, 19);
      });
    }),

  ecosystem: square('Ecosystem',
    'producers, consumers and decomposers cycling round. Use for: ecosystems, ecology, nutrient cycles, biodiversity',
    'items (up to 4 labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 4);
      const parts = ['Producers', 'Consumers', 'Predators', 'Decomposers']
        .map((d, i) => names[i] || d);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      parts.forEach((n, i) => {
        const a = (i / parts.length) * Math.PI * 2 - Math.PI / 2;
        const next = ((i + 1) / parts.length) * Math.PI * 2 - Math.PI / 2;
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        arcArrow(p, cx, cy, r, a + 0.28, next - 0.28, tint(p, colors.good, 190), 4);
        bubble(p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 40 * on, '', colors, { lit: i === 0 });
        caption(p, n, cx + Math.cos(a) * r, cy + Math.sin(a) * r + 56, colors, 17);
      });
    }),

  microbe: square('Microbe',
    'a single-celled organism magnified. Use for: microbiology, bacteria, viruses, cells under a microscope',
    'mode ("bacteria" or "virus")',
    ({ p, time, width, height, params, colors }) => {
      const virus = String(params.mode || 'bacteria') === 'virus';
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.22;
      p.push();
      p.stroke(colors.text);
      p.strokeWeight(4);
      p.fill(tint(p, colors.good, 90));
      if (virus) p.circle(cx, cy, r * 2);
      else p.ellipse(cx, cy, r * 2.6, r * 1.4);
      p.pop();
      const spikes = virus ? 14 : 8;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + (virus ? 0 : time * 0.6);
        const rr = virus ? r : r * 1.3;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * (virus ? r : r * 0.7);
        wire(p, x, y, x + Math.cos(a) * 22, y + Math.sin(a) * 22, colors.accent, 4);
      }
      caption(p, virus ? 'Virus' : 'Bacterium', cx, height * 0.86, colors, 22);
    }),

  // --- maths and aptitude ------------------------------------------------
  'unit-circle': square('Unit circle',
    'an angle on a circle with its sine and cosine. Use for: trigonometry, identities, sine and cosine, angles',
    'angle (0-360 degrees)',
    ({ p, progress, width, height, params, colors }) => {
      const deg = num(params.angle, 45, 0, 360) * Math.min(1, progress * 1.4);
      const a = (-deg * Math.PI) / 180;
      const cx = width / 2;
      const cy = height * 0.5;
      const r = Math.min(width, height) * 0.32;
      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(3);
      p.circle(cx, cy, r * 2);
      p.line(cx - r, cy, cx + r, cy);
      p.line(cx, cy - r, cx, cy + r);
      p.pop();
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      wire(p, cx, cy, x, y, colors.accent, 5);
      wire(p, x, y, x, cy, colors.good, 4);
      wire(p, cx, cy, x, cy, '#ff9f43', 4);
      junction(p, x, y, colors.text, 16);
      caption(p, 'sin', x + 34, (y + cy) / 2, colors, 20);
      caption(p, 'cos', (cx + x) / 2, cy + 28, colors, 20);
      caption(p, Math.round(deg) + '°', cx + 46, cy - 22, colors, 20);
    }),

  solids: wide('Solid shapes',
    'a cylinder, cone and sphere side by side. Use for: mensuration, volume, surface area, 3D shapes',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const xs = spread(3, width * 0.22, width * 0.78);
      const cy = height * 0.5;
      const s = Math.min(width * 0.16, height * 0.34);
      const on = (i: number) => stagger(progress, i, 0.16);
      if (on(0) > 0) {
        p.push();
        p.noFill();
        p.stroke(colors.accent);
        p.strokeWeight(4);
        p.ellipse(xs[0], cy - s, s * 1.2, s * 0.4);
        p.line(xs[0] - s * 0.6, cy - s, xs[0] - s * 0.6, cy + s);
        p.line(xs[0] + s * 0.6, cy - s, xs[0] + s * 0.6, cy + s);
        p.arc(xs[0], cy + s, s * 1.2, s * 0.4, 0, Math.PI);
        p.pop();
        caption(p, 'Cylinder', xs[0], cy + s + 48, colors, 19);
      }
      if (on(1) > 0) {
        p.push();
        p.noFill();
        p.stroke(colors.accent);
        p.strokeWeight(4);
        p.line(xs[1], cy - s, xs[1] - s * 0.6, cy + s);
        p.line(xs[1], cy - s, xs[1] + s * 0.6, cy + s);
        p.ellipse(xs[1], cy + s, s * 1.2, s * 0.4);
        p.pop();
        caption(p, 'Cone', xs[1], cy + s + 48, colors, 19);
      }
      if (on(2) > 0) {
        p.push();
        p.noFill();
        p.stroke(colors.accent);
        p.strokeWeight(4);
        p.circle(xs[2], cy, s * 1.6);
        p.ellipse(xs[2], cy, s * 1.6, s * 0.5);
        p.pop();
        caption(p, 'Sphere', xs[2], cy + s + 48, colors, 19);
      }
    }),

  alligation: wide('Alligation',
    'two prices either side of a mean, with the ratio underneath. Use for: alligation, weighted average, mixtures, blending',
    'items (2 with values), ratio (the mean)',
    ({ p, progress, width, height, params, items, colors }) => {
      const vs = values(items, 2);
      const a = vs[0]?.value ?? 20;
      const b = vs[1]?.value ?? 40;
      const mean = num(params.ratio, (a + b) / 2, Math.min(a, b), Math.max(a, b));
      const cy = height * 0.32;
      title(p, String(a), width * 0.28, cy, colors, 34);
      title(p, String(b), width * 0.72, cy, colors, 34);
      title(p, String(Math.round(mean)), width / 2, height * 0.54, colors, 34);
      if (progress > 0.35) {
        wire(p, width * 0.32, cy + 20, width * 0.47, height * 0.5, colors.dim, 3);
        wire(p, width * 0.68, cy + 20, width * 0.53, height * 0.5, colors.dim, 3);
      }
      if (progress > 0.6) {
        wire(p, width * 0.47, height * 0.6, width * 0.32, height * 0.78, colors.accent, 3);
        wire(p, width * 0.53, height * 0.6, width * 0.68, height * 0.78, colors.accent, 3);
        title(p, String(Math.abs(Math.round(b - mean))), width * 0.28, height * 0.84, colors, 30);
        title(p, String(Math.abs(Math.round(mean - a))), width * 0.72, height * 0.84, colors, 30);
      }
    }),

  calendar: square('Calendar',
    'a month grid with a day picked out. Use for: calendars, odd days, day of the week, leap years',
    'count (1-31, the date), ratio (0-6, which weekday the month starts on)',
    ({ p, progress, width, height, params, colors }) => {
      const date = Math.round(num(params.count, 15, 1, 31));
      const start = Math.round(num(params.ratio, 2, 0, 6));
      const s = Math.min(width, height) * 0.11;
      const ox = width / 2 - s * 3.5;
      const oy = height * 0.24;
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => {
        caption(p, d, ox + i * s + s / 2, oy - 20, colors, 18);
      });
      for (let i = 0; i < 35; i++) {
        const day = i - start + 1;
        if (day < 1 || day > 31) continue;
        const on = stagger(progress, i, 0.02, 3.4);
        if (on <= 0) continue;
        const x = ox + (i % 7) * s;
        const y = oy + Math.floor(i / 7) * s;
        const hit = day === date;
        p.push();
        p.stroke(hit ? colors.accent : colors.dim);
        p.strokeWeight(hit ? 4 : 1);
        p.fill(tint(p, hit ? colors.accent : colors.bg, hit ? 130 : 255));
        p.rect(x + 2, y + 2, s - 4, s - 4, 4);
        p.noStroke();
        p.fill(colors.text);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(s * 0.34);
        p.text(String(day), x + s / 2, y + s / 2);
        p.pop();
      }
    }),

  'rounding-line': wide('Rounding',
    'a value on a line snapping to the nearest option. Use for: approximation, estimation, rounding, nearest option',
    'items (2-5 options with values), ratio (the true value)',
    ({ p, progress, width, height, params, items, colors }) => {
      const vs = values(items, 5);
      const list = vs.length ? vs : [{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 30 }];
      const lo = Math.min(...list.map((v) => v.value));
      const hi = Math.max(...list.map((v) => v.value));
      const actual = num(params.ratio, (lo + hi) / 2, lo, hi);
      const y = height * 0.52;
      wire(p, width * 0.1, y, width * 0.9, y, colors.dim, 4);
      const at = (v: number) => width * 0.1 + ((v - lo) / safe(hi - lo)) * width * 0.8;
      list.forEach((v, i) => {
        const on = stagger(progress, i, 0.1);
        if (on <= 0) return;
        junction(p, at(v.value), y, colors.text, 16);
        caption(p, v.label, at(v.value), y + 36, colors, 19);
      });
      if (progress > 0.5) {
        const nearest = list.reduce((best, v) =>
          Math.abs(v.value - actual) < Math.abs(best.value - actual) ? v : best, list[0]);
        arrow(p, at(actual), y - 74, at(nearest.value), y - 18, colors.accent, 5);
        caption(p, String(Math.round(actual)), at(actual), y - 96, colors, 22);
      }
    }),

  // --- general knowledge, environment, civics ----------------------------
  'pollution-source': wide('Pollution',
    'sources feeding into air or water. Use for: pollution, air quality, emissions, environment',
    'items (2-4 sources)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 4);
      const list = names.length ? names : ['Traffic', 'Industry', 'Burning'];
      const xs = spread(list.length, width * 0.18, width * 0.82);
      list.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        box(p, xs[i], height * 0.24, width * 0.18, height * 0.16, n, colors);
        arrow(p, xs[i], height * 0.33, width / 2, height * 0.56, tint(p, '#ff6b6b', 200), 4);
      });
      p.push();
      p.noStroke();
      p.fill(tint(p, '#ff6b6b', 90));
      p.ellipse(width / 2, height * 0.7, width * 0.5, height * 0.26);
      p.pop();
      caption(p, 'Air quality falls', width / 2, height * 0.7, colors, 22);
    }),

  recycling: square('Recycling loop',
    'material used, collected and made again. Use for: recycling, waste, circular economy, sustainability',
    'items (up to 4 stage labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 4);
      const parts = ['Make', 'Use', 'Collect', 'Reprocess'].map((d, i) => names[i] || d);
      const cx = width / 2;
      const cy = height * 0.48;
      const r = Math.min(width, height) * 0.3;
      parts.forEach((n, i) => {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const next = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        arcArrow(p, cx, cy, r, a + 0.3, next - 0.3, tint(p, colors.good, 200), 5);
        bubble(p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 42 * on, '', colors, { lit: i === 3 });
        caption(p, n, cx + Math.cos(a) * r, cy + Math.sin(a) * r, colors, 18);
      });
    }),

  'ozone-layer': wide('Atmosphere layers',
    'bands of atmosphere with one shielding the ground. Use for: ozone, atmosphere layers, UV, greenhouse gases',
    'items (up to 4 layer names)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 4);
      const layers = ['Exosphere', 'Mesosphere', 'Ozone', 'Troposphere'].map((d, i) => names[i] || d);
      const h = (height * 0.62) / safe(layers.length);
      layers.forEach((n, i) => {
        const on = stagger(progress, i, 0.12);
        if (on <= 0) return;
        const y = height * 0.14 + i * h;
        p.push();
        p.noStroke();
        p.fill(tint(p, i === 2 ? colors.good : colors.accent, 60 + i * 30));
        p.rect(0, y, width * on, h - 4);
        p.pop();
        caption(p, n, width * 0.5, y + h / 2, colors, 20);
      });
      if (progress > 0.7) {
        arrow(p, width * 0.2, height * 0.06, width * 0.2, height * 0.14 + h * 2.4, '#ff9f43', 5);
        caption(p, 'UV', width * 0.2, height * 0.04, colors, 18);
      }
    }),

  'gov-structure': square('Three branches',
    'the parts of a government and what each does. Use for: polity, constitution, separation of powers, civics',
    'items (up to 3 branch labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 3);
      const parts = ['Legislature', 'Executive', 'Judiciary'].map((d, i) => names[i] || d);
      const cx = width / 2;
      const cy = height * 0.5;
      const r = Math.min(width, height) * 0.28;
      parts.forEach((n, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        box(p, x, y, width * 0.26, height * 0.15, n, colors, { lit: i === 0 });
        const nx = cx + Math.cos(((i + 1) / 3) * Math.PI * 2 - Math.PI / 2) * r;
        const ny = cy + Math.sin(((i + 1) / 3) * Math.PI * 2 - Math.PI / 2) * r;
        wire(p, x, y, nx, ny, colors.dim, 2);
      });
    }),

  'river-map': wide('River and tributaries',
    'a main river with tributaries joining it. Use for: rivers, geography, tributaries, drainage',
    'items (2-4 tributary names), labelA (the main river)',
    ({ p, progress, width, height, params, items, colors }) => {
      const names = labels(items, 4);
      const y = height * 0.62;
      p.push();
      p.noFill();
      p.stroke('#5aa9e6');
      p.strokeWeight(9);
      p.beginShape();
      for (let x = 0; x <= width; x += 10) {
        p.vertex(x, y + Math.sin((x / safe(width)) * Math.PI * 2) * height * 0.08);
      }
      p.endShape();
      p.pop();
      caption(p, clean(params.labelA, 16) || 'Main river', width * 0.5, y + height * 0.24, colors, 22);
      names.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const x = width * (0.24 + i * 0.2);
        const jy = y + Math.sin((x / safe(width)) * Math.PI * 2) * height * 0.08;
        p.push();
        p.noFill();
        p.stroke(tint(p, '#5aa9e6', 190));
        p.strokeWeight(5);
        p.line(x - width * 0.08, jy - height * 0.28 * on, x, jy);
        p.pop();
        caption(p, n, x - width * 0.08, jy - height * 0.3, colors, 17);
      });
    }),

  'metal-nonmetal': wide('Metals and non-metals',
    'two columns comparing properties. Use for: metals, non-metals, alloys, material properties',
    'items (2-4 properties), labelA and labelB (the two materials)',
    ({ p, progress, width, height, params, items, colors }) => {
      const rows = labels(items, 4);
      const list = rows.length ? rows : ['Conducts', 'Shiny', 'Malleable'];
      caption(p, clean(params.labelA, 12) || 'Metal', width * 0.32, height * 0.16, colors, 24);
      caption(p, clean(params.labelB, 12) || 'Non-metal', width * 0.72, height * 0.16, colors, 24);
      const rowH = (height * 0.6) / safe(list.length);
      list.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const y = height * 0.3 + i * rowH;
        caption(p, n, width * 0.1, y, colors, 19);
        [0.32, 0.72].forEach((fx, k) => {
          p.push();
          p.noStroke();
          p.fill(k === 0 ? colors.good : '#ff6b6b');
          p.circle(width * fx, y, 30);
          p.pop();
          caption(p, k === 0 ? '✓' : '✗', width * fx, y, colors, 20);
        });
      });
    }),

  'vitamin-table': wide('Deficiency table',
    'a nutrient paired with what its lack causes. Use for: vitamins, deficiencies, diseases, nutrition',
    'items (2-5 pairs; label is the nutrient, symbol is the effect)',
    ({ p, progress, width, height, items, colors }) => {
      const pairs = (items || []).slice(0, 5).filter((i) => i && i.label);
      if (!pairs.length) return;
      const rowH = (height * 0.66) / safe(pairs.length);
      pairs.forEach((pair, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const y = height * 0.2 + i * rowH;
        box(p, width * 0.26, y, width * 0.28, rowH * 0.7, clean(pair.label, 14), colors, { lit: true });
        arrow(p, width * 0.42, y, width * 0.54, y, colors.dim, 3, 10);
        box(p, width * 0.72, y, width * 0.32, rowH * 0.7, clean(pair.symbol, 16), colors);
      });
    }),

  'cyber-safety': square('Cyber safety',
    'a threat blocked before it reaches the data. Use for: cyber security, viruses, firewalls, safe practice',
    'labelA (the threat)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.48;
      const t = Math.min(1, progress * 1.6);
      p.push();
      p.noStroke();
      p.fill('#ff6b6b');
      p.circle(width * 0.16 + width * 0.24 * t, cy, 44);
      p.pop();
      caption(p, clean(params.labelA, 12) || 'Virus', width * 0.16 + width * 0.24 * t, cy - 46, colors, 19);
      p.push();
      p.stroke(colors.good);
      p.strokeWeight(9);
      p.noFill();
      p.line(width * 0.52, height * 0.16, width * 0.52, height * 0.84);
      p.pop();
      caption(p, 'Firewall', width * 0.52, height * 0.9, colors, 20);
      box(p, width * 0.78, cy, width * 0.26, height * 0.28, 'Your data', colors, { lit: true });
    }),

  'generations-timeline': wide('Generations',
    'stages laid out along a line with what changed at each. Use for: computer generations, eras, history of science, inventions',
    'items (3-5 stages)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      if (!names.length) return;
      const y = height * 0.5;
      wire(p, width * 0.08, y, width * 0.92 * Math.min(1, progress * 1.4), y, colors.dim, 5);
      const xs = spread(names.length, width * 0.16, width * 0.86);
      names.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        junction(p, xs[i], y, colors.accent, 22 * on);
        caption(p, n, xs[i], y + (i % 2 ? 46 : -46), colors, 18);
      });
    }),

  truss: wide('Truss',
    'a frame of triangles carrying a load. Use for: structures, bridges, statics, towers, load paths',
    'count (3-6 bays), labelA (the load)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 3, 6));
      const left = width * 0.1;
      const right = width * 0.9;
      const top = height * 0.34;
      const bottom = height * 0.66;
      const xs = spread(n + 1, left, right);
      p.push();
      p.stroke(colors.accent);
      p.strokeWeight(5);
      p.noFill();
      xs.forEach((x, i) => {
        const on = stagger(progress, i, 0.08, 2.6);
        if (on <= 0) return;
        if (i < xs.length - 1) {
          p.line(x, bottom, xs[i + 1], bottom);
          if (i < xs.length - 2) p.line(x, top, xs[i + 1], top);
          p.line(x, bottom, xs[i + 1], i % 2 ? bottom : top);
        }
        if (i > 0 && i < xs.length - 1) p.line(x, top, x, bottom);
      });
      p.pop();
      xs.forEach((x, i) => { if (i > 0 && i < xs.length - 1) junction(p, x, top, colors.text, 12); });
      arrow(p, width / 2, top - 80, width / 2, top - 10, '#ff6b6b', 6, 18);
      caption(p, clean(params.labelA, 10) || 'Load', width / 2, top - 100, colors, 20);
    }),

  'engine-cycle': square('Four stroke',
    'a piston through intake, compression, power and exhaust. Use for: engines, four stroke, turbines, combustion',
    'count (1-4, which stroke to show)',
    ({ p, progress, width, height, params, colors }) => {
      const strokes = ['Intake', 'Compress', 'Power', 'Exhaust'];
      const which = Math.round(num(params.count, 1 + Math.floor(progress * 3.9), 1, 4)) - 1;
      const cx = width / 2;
      const top = height * 0.2;
      const h = height * 0.46;
      const w = Math.min(width * 0.3, height * 0.34);
      p.push();
      p.noFill();
      p.stroke(colors.text);
      p.strokeWeight(5);
      p.rect(cx - w / 2, top, w, h, 6);
      p.pop();
      const depth = [0.2, 0.7, 0.25, 0.7][which] ?? 0.4;
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.rect(cx - w / 2 + 6, top + h * depth, w - 12, h * 0.16, 4);
      p.pop();
      if (which === 2) {
        p.push();
        p.noStroke();
        p.fill(tint(p, '#ff8c42', 170));
        p.rect(cx - w / 2 + 6, top + 6, w - 12, h * depth - 8, 4);
        p.pop();
      }
      caption(p, strokes[which] || 'Intake', cx, height * 0.82, colors, 24);
    }),

  'failure-point': wide('Failure',
    'stress rising to the point where something gives. Use for: failure analysis, strength, breaking point, safety factor',
    'ratio (0.5-0.9, where it fails)',
    ({ p, progress, width, height, params, colors }) => {
      const at = num(params.ratio, 0.72, 0.5, 0.9);
      const plot = axes(p, width, height, colors, { x: 'Load', y: 'Stress' });
      curve(p, plot, (t) => (t < at ? t * 1.1 : at * 1.1 - (t - at) * 2.4), colors.accent,
            Math.min(progress, 1));
      if (progress > at) {
        junction(p, plot.x(at), plot.y(at * 1.1), '#ff6b6b', 22);
        caption(p, 'Fails here', plot.x(at) + 60, plot.y(at * 1.1) - 24, colors, 20);
      }
    }),

  recursion: square('Recursion',
    'a shape containing a smaller copy of itself. Use for: recursion, self-similarity, fractals, nested structures',
    'count (2-5 levels)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 4, 2, 5));
      const cx = width / 2;
      const cy = height * 0.48;
      let s = Math.min(width, height) * 0.7;
      for (let i = 0; i < n; i++) {
        const on = stagger(progress, i, 0.18);
        if (on <= 0) break;
        p.push();
        p.noFill();
        p.stroke(tint(p, colors.accent, 240 - i * 40));
        p.strokeWeight(5 - i * 0.6);
        p.rect(cx - s / 2, cy - s / 2, s, s, 8);
        p.pop();
        s *= 0.62;
      }
      caption(p, 'Each step calls itself', cx, height * 0.94, colors, 20);
    }),

  eigenvector: square('Eigenvector',
    'a transformation that stretches one direction and turns the rest. Use for: eigenvalues, eigenvectors, linear algebra, matrix transformations',
    'ratio (1-3, the eigenvalue)',
    ({ p, progress, width, height, params, colors }) => {
      const lambda = num(params.ratio, 2, 1, 3);
      const cx = width / 2;
      const cy = height * 0.5;
      const r = Math.min(width, height) * 0.3;
      const t = Math.min(1, progress * 1.5);
      p.push();
      p.stroke(colors.dim);
      p.strokeWeight(2);
      p.line(cx - r, cy, cx + r, cy);
      p.line(cx, cy - r, cx, cy + r);
      p.pop();
      // The eigenvector only gets longer; every other vector also rotates.
      arrow(p, cx, cy, cx + r * 0.6 * (1 + (lambda - 1) * t), cy, colors.accent, 6);
      caption(p, 'stretched ×' + lambda.toFixed(1), cx + r * 0.5, cy - 34, colors, 19);
      const a = -0.9 - t * 0.7;
      arrow(p, cx, cy, cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, colors.dim, 5);
      caption(p, 'turned', cx + Math.cos(a) * r * 0.7 + 40, cy + Math.sin(a) * r * 0.7, colors, 19);
    }),

  'differential-equation': wide('Differential equation',
    'a slope field with one solution curve threading through it. Use for: differential equations, rates of change, growth models, calculus',
    'mode ("growth" or "decay")',
    ({ p, progress, width, height, params, colors }) => {
      const decay = String(params.mode || 'growth') === 'decay';
      const plot = axes(p, width, height, colors, { x: 't', y: 'y' });
      for (let i = 1; i < 9; i++) {
        for (let j = 1; j < 6; j++) {
          const t = i / 9;
          const v = j / 6;
          const slope = decay ? -v * 0.8 : v * 0.8;
          const x = plot.x(t);
          const y = plot.y(v);
          const d = 16;
          wire(p, x - d, y + slope * d, x + d, y - slope * d, tint(p, colors.dim, 150), 2);
        }
      }
      curve(p, plot, (t) => (decay ? 0.85 * Math.exp(-t * 2.2) : 0.12 * Math.exp(t * 1.9)),
            colors.accent, progress);
    }),

  'trade-flow': wide('Trade',
    'goods moving between countries with a tariff in the way. Use for: trade, tariffs, imports and exports, balance of payments',
    'labelA and labelB (the two countries), ratio (0-1, the tariff)',
    ({ p, progress, width, height, params, colors }) => {
      const tariff = num(params.ratio, 0.3, 0, 1);
      const cy = height * 0.46;
      box(p, width * 0.16, cy, width * 0.2, height * 0.24, clean(params.labelA, 10) || 'A', colors, { lit: true });
      box(p, width * 0.84, cy, width * 0.2, height * 0.24, clean(params.labelB, 10) || 'B', colors);
      const t = Math.min(1, progress * 1.5);
      arrow(p, width * 0.28, cy - 34, width * 0.28 + width * 0.44 * t, cy - 34, colors.accent, 5);
      arrow(p, width * 0.72, cy + 34, width * 0.72 - width * 0.44 * t, cy + 34, colors.good, 5);
      if (tariff > 0.05) {
        p.push();
        p.stroke('#ff6b6b');
        p.strokeWeight(4 + tariff * 12);
        p.line(width * 0.5, cy - 74, width * 0.5, cy + 74);
        p.pop();
        caption(p, 'Tariff', width * 0.5, cy + 100, colors, 20);
      }
    }),

  banking: wide('Banking',
    'deposits lent on and coming back as new deposits. Use for: money and banking, credit creation, interest, the money supply',
    'count (2-4 rounds)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 3, 2, 4));
      const rowH = (height * 0.62) / safe(n);
      for (let i = 0; i < n; i++) {
        const on = stagger(progress, i, 0.18);
        if (on <= 0) continue;
        const y = height * 0.24 + i * rowH;
        const w = width * 0.6 * Math.pow(0.7, i);
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 220 - i * 40));
        p.rect(width / 2 - w / 2, y, w * on, rowH * 0.62, 6);
        p.pop();
        caption(p, i === 0 ? 'Deposit' : 'Lent on', width / 2, y + rowH * 0.31, colors, 19);
      }
      caption(p, 'Each round is smaller', width / 2, height * 0.94, colors, 20);
    }),

  'economic-indicators': wide('Indicators',
    'several economic measures side by side as dials. Use for: economic indicators, GDP, inflation and unemployment, dashboards',
    'items (2-4 measures, each with a label and a value 0-100)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 4);
      const list = vs.length ? vs : [{ label: 'GDP', value: 62 }, { label: 'Inflation', value: 38 }];
      const xs = spread(list.length, width * 0.22, width * 0.78);
      const r = Math.min(width / safe(list.length) * 0.32, height * 0.24);
      list.forEach((v, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const frac = Math.min(1, Math.abs(v.value) / 100) * on;
        p.push();
        p.noFill();
        p.stroke(tint(p, colors.dim, 90));
        p.strokeWeight(16);
        p.arc(xs[i], height * 0.52, r * 2, r * 2, Math.PI, Math.PI * 2);
        p.stroke(colors.accent);
        p.arc(xs[i], height * 0.52, r * 2, r * 2, Math.PI, Math.PI + Math.PI * frac);
        p.pop();
        title(p, String(Math.round(v.value)), xs[i], height * 0.48, colors, 26);
        caption(p, v.label, xs[i], height * 0.66, colors, 19);
      });
    }),

  'personality-axes': square('Personality traits',
    'traits plotted as opposing ends of scales. Use for: personality, traits, psychometrics, self-assessment',
    'items (2-4 traits, each with a label and a value -100 to 100)',
    ({ p, progress, width, height, items, colors }) => {
      const vs = values(items, 4);
      const list = vs.length ? vs : [{ label: 'Open', value: 60 }, { label: 'Calm', value: -30 }];
      const rowH = (height * 0.6) / safe(list.length);
      list.forEach((v, i) => {
        const on = stagger(progress, i, 0.16);
        if (on <= 0) return;
        const y = height * 0.26 + i * rowH;
        wire(p, width * 0.18, y, width * 0.82, y, colors.dim, 4);
        setDash(p, true);
        wire(p, width / 2, y - 18, width / 2, y + 18, colors.dim, 2);
        setDash(p, false);
        const x = width / 2 + (Math.max(-100, Math.min(100, v.value)) / 100) * width * 0.3 * on;
        junction(p, x, y, colors.accent, 24);
        caption(p, v.label, width / 2, y - 34, colors, 19);
      });
    }),

  conformity: wide('Conformity',
    'one person differing from a group that all agree. Use for: social influence, conformity, peer pressure, group behaviour',
    'count (3-7 in the group)',
    ({ p, progress, width, height, params, colors }) => {
      const n = Math.round(num(params.count, 5, 3, 7));
      const xs = spread(n, width * 0.16, width * 0.84);
      const cy = height * 0.46;
      xs.forEach((x, i) => {
        const odd = i === n - 1;
        const on = stagger(progress, i, 0.1);
        if (on <= 0) return;
        // The odd one out drifts back into line as the scene plays.
        const drift = odd ? (1 - Math.min(1, Math.max(0, progress * 1.6 - 0.6))) * height * 0.18 : 0;
        bubble(p, x, cy + drift, 34 * on, '', colors, { lit: odd });
      });
      caption(p, 'The odd one moves into line', width / 2, height * 0.84, colors, 20);
    }),

  perception: square('Perception',
    'the same shape read two different ways. Use for: perception, illusions, ambiguity, how the brain fills in gaps',
    'no parameters',
    ({ p, progress, width, height, colors }) => {
      const cx = width / 2;
      const cy = height * 0.48;
      const s = Math.min(width, height) * 0.26;
      // A Kanizsa-style figure: three notched discs imply a triangle that is
      // not drawn anywhere, which is the whole point.
      [0, 1, 2].forEach((i) => {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * s;
        const y = cy + Math.sin(a) * s;
        p.push();
        p.noStroke();
        p.fill(colors.text);
        p.circle(x, y, s * 0.7);
        p.fill(colors.bg);
        p.arc(x, y, s * 0.72, s * 0.72, a + Math.PI - 0.6, a + Math.PI + 0.6, p.PIE);
        p.pop();
      });
      if (progress > 0.6) {
        caption(p, 'You see a triangle that is not there', cx, height * 0.9, colors, 20);
      }
    }),

  biotech: wide('Biotechnology',
    'a gene cut from one organism and put into another. Use for: biotechnology, genetic engineering, GM, cloning',
    'labelA (the gene)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.46;
      p.push();
      p.noFill();
      p.stroke(colors.dim);
      p.strokeWeight(7);
      p.arc(width * 0.22, cy, 150, 150, 0, Math.PI * 2);
      p.pop();
      const t = Math.min(1, progress * 1.6);
      const x = width * 0.22 + (width * 0.56) * t;
      p.push();
      p.noStroke();
      p.fill(colors.accent);
      p.rect(x - 26, cy - 11, 52, 22, 5);
      p.pop();
      caption(p, clean(params.labelA, 12) || 'Gene', x, cy - 38, colors, 19);
      p.push();
      p.noFill();
      p.stroke(t > 0.9 ? colors.good : colors.dim);
      p.strokeWeight(7);
      p.arc(width * 0.78, cy, 150, 150, 0, Math.PI * 2);
      p.pop();
      caption(p, 'Donor', width * 0.22, cy + 106, colors, 19);
      caption(p, 'Host', width * 0.78, cy + 106, colors, 19);
    }),

  manufacturing: wide('Manufacturing',
    'raw material shaped through stages into a finished part. Use for: manufacturing processes, production lines, machining, assembly',
    'items (3-5 stage labels)',
    ({ p, progress, width, height, items, colors }) => {
      const names = labels(items, 5);
      const stages = names.length ? names : ['Cast', 'Machine', 'Finish', 'Inspect'];
      const xs = spread(stages.length, width * 0.16, width * 0.84);
      const cy = height * 0.46;
      wire(p, width * 0.08, cy + height * 0.2, width * 0.92, cy + height * 0.2, colors.dim, 6);
      stages.forEach((n, i) => {
        const on = stagger(progress, i, 0.14);
        if (on <= 0) return;
        const size = 68 - i * 8;
        p.push();
        p.noStroke();
        p.fill(tint(p, colors.accent, 150 + i * 24));
        p.rect(xs[i] - size / 2, cy - size / 2, size, size, i === stages.length - 1 ? 14 : 3);
        p.pop();
        caption(p, n, xs[i], cy + height * 0.28, colors, 18);
        if (i > 0 && stagger(progress, i - 1, 0.14) > 0.9) {
          arrow(p, xs[i - 1] + 44, cy, xs[i] - 44, cy, colors.dim, 3, 11);
        }
      });
    }),

  'misconception': wide('Myth and fact',
    'a common belief set against what is actually true. Use for: misconceptions, myths, surprising facts, common errors',
    'labelA (the belief), labelB (the truth)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.46;
      box(p, width * 0.27, cy, width * 0.36, height * 0.32, clean(params.labelA, 20) || 'Common belief',
          colors);
      p.push();
      p.stroke('#ff6b6b');
      p.strokeWeight(7);
      p.line(width * 0.13, cy + height * 0.14, width * 0.41, cy - height * 0.14);
      p.pop();
      if (progress > 0.45) {
        box(p, width * 0.73, cy, width * 0.36, height * 0.32, clean(params.labelB, 20) || 'Actually',
            colors, { lit: true });
      }
      caption(p, 'Myth', width * 0.27, cy + height * 0.26, colors, 20);
      caption(p, 'Fact', width * 0.73, cy + height * 0.26, colors, 20);
    }),

  cryptography: wide('Encryption',
    'a message scrambled by a key and unscrambled again. Use for: cryptography, encryption, keys, secure messages',
    'labelA (the message)',
    ({ p, progress, width, height, params, colors }) => {
      const cy = height * 0.46;
      const msg = clean(params.labelA, 8) || 'HELLO';
      box(p, width * 0.16, cy, width * 0.18, height * 0.2, msg, colors, { lit: true });
      box(p, width * 0.5, cy, width * 0.16, height * 0.24, 'Key', colors);
      const scrambled = msg.split('').reverse().join('');
      if (progress > 0.5) {
        box(p, width * 0.84, cy, width * 0.18, height * 0.2, scrambled, colors);
      }
      arrow(p, width * 0.26, cy, width * 0.41, cy, colors.accent, 4);
      if (progress > 0.45) arrow(p, width * 0.59, cy, width * 0.74, cy, colors.good, 4);
      caption(p, 'Plain', width * 0.16, cy + height * 0.18, colors, 19);
      caption(p, 'Cipher', width * 0.84, cy + height * 0.18, colors, 19);
    }),
};
