// ---------------------------------------------------------------------------
// Digital logic, simulated: the timing diagram.
//
// What the video draws for this is NOT the p5 drawing below. A timing diagram
// is read by src/lib/timing.ts, its outputs worked out edge by edge, and drawn
// by WaveDrom (TimingView in src/remotion/TimingView.tsx). The drawing here is
// the same simulation in plain lines, kept for a frame the WaveDrom view
// cannot take - and so the library's own tests can see it draw.
// ---------------------------------------------------------------------------

import type { SketchDef } from './sketches';
import { clean } from './sketch-parts';
import { readTiming } from '../lib/timing';

export const LOGIC_SKETCHES: Record<string, SketchDef> = {
  'timing-diagram': {
    shape: 'wide',
    label: 'Timing diagram',
    describe: 'A timing diagram whose outputs are SIMULATED from the circuit you name and the inputs you give - never drawn from memory. Use for: flip-flops (D, T, JK), an SR latch, a counter, a gate\'s output against its inputs, a frequency divider, any "what is Q after each clock" question. Not for a single gate symbol - logic-gate draws that',
    uses: 'mode (the circuit: "and", "or", "nand", "nor", "xor", "xnor", "not", "sr-latch", "d-flipflop", "t-flipflop", "jk-flipflop" or "counter"), network (the INPUTS only, one per cycle as 0s and 1s, separated by semicolons: "A=0011; B=0101" for a gate, "S=1000; R=0010" for a latch, "D=10110", "T=1111", "J=1100; K=0110" for a flip-flop - the clock is drawn for you. Every output starts at 0 unless you add "Q0=1". For a counter write only its size, "bits=3". Never write an output: Q, Y and the counter\'s bits are worked out from the inputs, edge by edge, positive-edge triggered), count (counter only: how many clock pulses to show, 2 to 12), labelB (optional - one output the working states, CHECKED against the simulation and the diagram dropped if it is wrong: "Q = 1010", or a counter\'s state after the last pulse "Q2Q1Q0 = 101")',
    draw: ({ p, progress, width, height, params, colors }) => {
      const { timing } = readTiming(params);
      if (!timing) return;
      const lanes = timing.lanes;
      const left = width * 0.14;
      const right = width * 0.95;
      const laneH = (height * 0.84) / lanes.length;
      const step = (right - left) / timing.cycles;
      const upto = left + (right - left) * Math.max(0, Math.min(1, progress * 1.3));
      p.textAlign(p.RIGHT, p.CENTER);
      p.textSize(Math.max(14, Math.min(34, laneH * 0.36)));
      lanes.forEach((lane, row) => {
        const top = height * 0.08 + row * laneH + laneH * 0.2;
        const bottom = top + laneH * 0.56;
        p.noStroke();
        p.fill(lane.kind === 'output' ? colors.accent : colors.text);
        p.text(clean(lane.name, 6), left - 14, (top + bottom) / 2);
        p.noFill();
        p.stroke(lane.kind === 'output' ? colors.accent : colors.text);
        p.strokeWeight(4);
        p.beginShape();
        for (let k = 0; k < timing.cycles; k++) {
          const x0 = left + k * step;
          if (x0 > upto) break;
          if (lane.kind === 'clock') {
            const mid = Math.min(upto, x0 + step / 2);
            p.vertex(x0, bottom); p.vertex(x0, top); p.vertex(mid, top);
            if (mid < x0 + step / 2) break;
            p.vertex(mid, bottom); p.vertex(Math.min(upto, x0 + step), bottom);
          } else {
            const y = lane.values[k] ? top : bottom;
            p.vertex(x0, y); p.vertex(Math.min(upto, x0 + step), y);
          }
        }
        p.endShape();
      });
    },
  },
};
