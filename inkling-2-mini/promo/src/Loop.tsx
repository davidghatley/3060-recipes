import React from 'react';
import {D, LOOP_N, P, PASSES, STEM, has} from './kit';

// The loop figure: layers as cells. Layers 0-5 run once, layers 6-17 (the looped core) run three times,
// then the token leaves. Built for the video (t steps through it) and for the stills (t = Infinity, finished state).

const M = D.model;
const PRE = M.loop_first;                                   // 6 layers before the loop
const CODA = has(M.layers) ? Math.max(0, M.layers - M.loop_last - 1) : 0;   // layers after the loop, if the GGUF says
const TIMES = M.loop_times;

export type LoopTiming = {go: number; pre: number; pass: number; back: number};
type State = {lit: number; pass: number; back: number; done: boolean; started: boolean};

/** Where the token is at time t: the layer it is in, which pass, and how far along the way back it is. */
export const loopState = (t: number, tm: LoopTiming): State => {
  if (t < tm.go) return {lit: -1, pass: 0, back: -1, done: false, started: false};
  if (t < tm.go + tm.pre) return {lit: Math.floor(((t - tm.go) / tm.pre) * PRE), pass: 0, back: -1, done: false, started: true};
  let s = tm.go + tm.pre;
  for (let p = 0; p < TIMES; p++) {
    if (t < s + tm.pass) return {lit: PRE + Math.floor(((t - s) / tm.pass) * LOOP_N), pass: p, back: -1, done: false, started: true};
    s += tm.pass;
    if (p < TIMES - 1) {
      if (t < s + tm.back) return {lit: -1, pass: p, back: (t - s) / tm.back, done: false, started: true};
      s += tm.back;
    }
  }
  return {lit: -1, pass: TIMES, back: -1, done: true, started: true};
};
export const loopEnd = (tm: LoopTiming) => tm.go + tm.pre + TIMES * tm.pass + (TIMES - 1) * tm.back;

export const LoopFigure: React.FC<{
  t: number; tm: LoopTiming; cw: number; ch: number; gap?: number; gg?: number; lab?: number; big?: number; loopH?: number;
  labels?: boolean; counter?: boolean; ends?: boolean;
}> = ({t, tm, cw, ch, gap = 8, gg = 48, lab = 32, big = 120, loopH = 96, labels = true, counter = true, ends = true}) => {
  const st = loopState(t, tm);
  const endW = ends ? lab * 2 + 8 : 0;          // "IN" / "OUT" columns (Stem 7 is 6 cells + 1 bearing per glyph)
  const outW = ends ? lab * 3 : 0;
  const x0 = endW + (ends ? gg : 0);
  const step = cw + gap;
  const preW = PRE * step - gap;
  const coreX = x0 + preW + gg;
  const coreW = LOOP_N * step - gap;
  const codaX = coreX + coreW + gg;
  const codaW = CODA ? CODA * step - gap : 0;
  const outX = (CODA ? codaX + codaW : coreX + coreW) + (ends ? gg : 0);
  const W = outX + outW;
  const top = big + 24 + loopH;                  // cells start under the ×3 numeral and the loop path
  const below = (labels ? lab + 24 : 0) + (counter ? lab + 48 : 0);
  const H = top + ch + below;
  const txt = (s: string, x: number, y: number, size: number, color: string, anchor: 'start' | 'middle' | 'end' = 'start') => (
    <text x={x} y={y} textAnchor={anchor} style={{fontFamily: STEM, fontSize: size, fill: color} as React.CSSProperties}>{s}</text>
  );

  // the loop path: from the core's right end, up, back left, down into its first layer
  const lx1 = coreX + cw / 2, lx2 = coreX + coreW - cw / 2, ly = top - loopH + 8, cy = top - 12;
  const pathPts: [number, number][] = [[lx2, cy], [lx2, ly], [lx1, ly], [lx1, cy]];
  const segs = pathPts.slice(1).map((p, i) => Math.hypot(p[0] - pathPts[i][0], p[1] - pathPts[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  const at = (k: number): [number, number] => {
    let d = k * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]) { const f = d / segs[i]; return [pathPts[i][0] + (pathPts[i + 1][0] - pathPts[i][0]) * f, pathPts[i][1] + (pathPts[i + 1][1] - pathPts[i][1]) * f]; }
      d -= segs[i];
    }
    return pathPts[pathPts.length - 1];
  };
  const tok = Math.round(cw * 0.5);
  const showLoop = st.started || t === Infinity;

  const cell = (i: number, x: number, core: boolean) => {
    const cur = st.lit === i;
    let fill: string = 'none', stroke: string = core ? P.cobalt : P.rule;
    if (core) {
      const visited = st.done || (st.lit > i && st.lit >= PRE) || (st.back >= 0) || st.pass > 0;
      if (visited) fill = P.cobalt;
    } else if (st.lit > i || st.lit >= PRE || st.back >= 0 || st.pass > 0 || st.done) fill = P.rule;
    if (cur) { fill = P.ink; stroke = P.ink; }
    return <rect key={i} x={x + 1} y={top + 1} width={cw - 2} height={ch - 2} fill={fill} stroke={stroke} strokeWidth={2} />;
  };

  return (
    <svg width={W} height={H} style={{display: 'block', overflow: 'visible'}} shapeRendering="crispEdges">
      {ends && txt('IN', 0, top + ch / 2 + lab / 2 - lab / 8, lab, P.muted)}
      {ends && st.done && txt('OUT', outX, top + ch / 2 + lab / 2 - lab / 8, lab, P.ink)}
      {Array.from({length: PRE}, (_, i) => cell(i, x0 + i * step, false))}
      {Array.from({length: LOOP_N}, (_, i) => cell(PRE + i, coreX + i * step, true))}
      {Array.from({length: CODA}, (_, i) => <rect key={`c${i}`} x={codaX + i * step + 1} y={top + 1} width={cw - 2} height={ch - 2} fill={st.done ? P.rule : 'none'} stroke={P.rule} strokeWidth={2} />)}
      {showLoop && (
        <g>
          <polyline points={pathPts.map((p) => p.join(',')).join(' ')} fill="none" stroke={P.cobalt} strokeWidth={6} strokeLinejoin="miter" />
          <polygon points={`${lx1 - 14},${cy - 18} ${lx1 + 14},${cy - 18} ${lx1},${cy}`} fill={P.cobalt} />
          {txt(`×${TIMES}`, (lx1 + lx2) / 2, ly - 24, big, P.cobalt, 'middle')}
          {st.back >= 0 && (() => { const [x, y] = at(st.back); return <rect x={x - tok / 2} y={y - tok / 2} width={tok} height={tok} fill={P.ink} />; })()}
        </g>
      )}
      {labels && (
        <g>
          {txt(`${0}–${PRE - 1}`, x0, top + ch + lab + 16, lab, P.muted)}
          {txt(coreW >= lab * 10 ? `${M.loop_first}–${M.loop_last} · LOOPED` : `${M.loop_first}–${M.loop_last} ×${TIMES}`, coreX, top + ch + lab + 16, lab, P.cobaltText)}
          {CODA > 0 && txt(`${M.loop_last + 1}–${M.layers - 1}`, codaX, top + ch + lab + 16, lab, P.muted)}
        </g>
      )}
      {counter && (
        <g>
          {txt('PASS', coreX, H - 8, lab, P.muted)}
          {Array.from({length: TIMES}, (_, p) => {
            const x = coreX + lab * 5 + p * (lab + 24);
            const doneP = st.done || st.pass > p || (st.pass === p && st.back >= 0);
            const live = !st.done && st.pass === p && st.lit >= PRE;
            return (
              <g key={p}>
                <rect x={x + 1} y={H - lab - 15} width={lab + 6} height={lab + 6} fill={doneP ? P.cobalt : 'none'} stroke={live || doneP ? P.cobalt : P.rule} strokeWidth={2} />
                {txt(String(p + 1), x + lab / 2 + 4, H - 12, lab, doneP ? P.onCobalt : live ? P.cobaltText : P.muted, 'middle')}
              </g>
            );
          })}
          {st.done && has(M.layers) && txt(`= ${PASSES} LAYERS PER TOKEN`, coreX + lab * 5 + TIMES * (lab + 24) + 16, H - 8, lab, P.ink)}
        </g>
      )}
    </svg>
  );
};
