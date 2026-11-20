import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile, useVideoConfig} from 'remotion';
import dataJson from '../data.json';
import {CHIP, Glyph, TypeOn, on} from '../house';
import PAL from './palette.json';

// v3 kit: Stem 7 for every headline, number, delta, label and the lockup name; IBM Plex Mono for command and flag lines only.
// Every number comes from data.json (tools/prep.py, from ../runs); nothing here is typed in by hand.

/* eslint-disable @typescript-eslint/no-explicit-any */
export const D = dataJson as any;
/**
 * The palette, from secret-sauce tokens.json (tools/sauce_palette.py writes palette.json): light = Plaster, dark = Night.
 * P is one shared object; each composition calls setTheme() at the top of its render, before any child reads P.
 * Fills use cobalt; small cobalt type (32/48 px labels and flag lines) uses cobaltText, which is the same colour in light.
 */
export type Theme = 'light' | 'dark';
export const P: typeof PAL.light = {...PAL.light};
export const setTheme = (th: Theme) => { Object.assign(P, PAL[th]); };

/**
 * Stem 7 sizes. 32 · 48 · 72 · 120 are the house steps.
 * Above 120 the house rule is broken on purpose: David approved oversize Stem 7 for the Flint promo (brief, 2026-11-18).
 * Every oversize step is a multiple of 8 px, so one Stem 7 cell (size / 8) still lands on whole pixels: 128 → 16 px, 160 → 20 px, 240 → 30 px.
 */
export const S = {
  label: 32,
  m: 48,
  l: 72,
  xl: 120,
  /* sauce-lint allow-next-line type-scale: approved oversize Stem 7 (Flint promo brief); 8 px grid, 16 px cells */
  x128: 128,
  /* sauce-lint allow-next-line type-scale: approved oversize Stem 7 (Flint promo brief); 8 px grid, 20 px cells */
  x160: 160,
  /* sauce-lint allow-next-line type-scale: approved oversize Stem 7 (Flint promo brief); 8 px grid, 30 px cells */
  x240: 240,
} as const;

export const MONO = '"IBM Plex Mono", monospace';
export const STEM = '"Stem 7", monospace';
const FACES = [
  ['IBM Plex Mono', 'IBMPlexMono-normal-400.woff2', '400'],
  ['IBM Plex Mono', 'IBMPlexMono-normal-600.woff2', '600'],
  ['Stem 7', 'Stem7-Regular.woff2', '400'],
  ['Hoop', 'Hoop-Bold.woff2', '700'],
] as const;
export const useFonts3 = () => {
  const [handle] = useState(() => delayRender('fonts-v3'));
  useEffect(() => {
    Promise.all(FACES.map(([fam, file, weight]) => {
      const f = new FontFace(fam, `url(${staticFile('fonts/' + file)})`, {weight, style: 'normal'});
      (document.fonts as unknown as Set<FontFace>).add(f);
      return f.load();
    })).then(() => continueRender(handle));
  }, [handle]);
};

export const useV = () => {
  const {width, height} = useVideoConfig();
  return height > width;
};
export const fmt = (n: number, dp = 0) => n.toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp});
export const pct = (a: number, b: number) => `+${Math.round((b / a - 1) * 100)}%`;
export const times = (a: number, b: number) => `${(b / a).toFixed(1)}×`;

/** Stem 7 at one size, line box = size (cap line to one cell under the baseline). */
export const px = (size: number, color: string = P.ink): React.CSSProperties => ({
  fontFamily: STEM, fontSize: size, lineHeight: `${size}px`, letterSpacing: 0, color, whiteSpace: 'pre',
  fontKerning: 'normal', fontSynthesis: 'none', fontVariantLigatures: 'common-ligatures', WebkitFontSmoothing: 'none',
} as React.CSSProperties);
export const Px: React.FC<{size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({size, color, style, children}) => <div style={{...px(size, color), ...style}}>{children}</div>;
/** Caps label, Stem 7 32 (4 px cells), one cell of tracking. */
export const Lab: React.FC<{color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({color = P.muted, style, children}) => <div style={{...px(S.label, color), letterSpacing: 4, ...style}}>{children}</div>;
export const mono = (size: number, color: string = P.ink, weight = 400): React.CSSProperties => ({fontFamily: MONO, fontWeight: weight, fontSize: size, lineHeight: `${size === 48 ? 64 : size === 32 ? 40 : size + 16}px`, color, whiteSpace: 'pre'});
export const show = (t: number, t0: number): React.CSSProperties => ({opacity: on(t, t0) ? 1 : 0});

/** A whole-number step count from `from` to `to` (built, not carried). */
export const count = (to: number, t: number, t0: number, dp = 0, from = 0, dur = 0.6) => {
  const k = Math.min(1, Math.max(0, (t - t0) / dur));
  return fmt(from + (to - from) * (Math.floor(k * 12) / 12), dp);
};

// ---------- geometry ----------
// 16:9: header rule at 96, footer rule at 1000, body 136..968.
// 9:16: header rule at 96, footer (two label lines) rule at 1472, last line ends 1568; bottom 320 px (1600..1920) left clear for X's UI.
export const M = 48;
export const body = (v: boolean) => (v ? {top: 128, bottom: 1448} : {top: 128, bottom: 976});

/** The body region between the header and footer rules; content centred vertically (Chromium snaps boxes and baselines to whole px). */
export const Body: React.FC<{children: React.ReactNode; align?: 'center' | 'top'}> = ({children, align = 'center'}) => {
  const v = useV();
  const {top, bottom} = body(v);
  return (
    <div style={{position: 'absolute', left: M, right: M, top, height: bottom - top, display: 'flex', flexDirection: 'column', justifyContent: align === 'top' ? 'flex-start' : 'center'}}>
      <div>{children}</div>
    </div>
  );
};

export const HW1 = `RTX 3060 12 GB · I5-12500 · 62 GB DDR5`;
export const HW2 = `LLAMA.CPP ${String(D.engine.build).toUpperCase()} · NO PATCHES`;
const CHAPTERS: [string, string][] = [['hook', 'FLINT ON A 3060'], ['bench', 'STOCK VS TUNED'], ['flags', 'THE FLAGS'], ['ctx', 'LONG CONTEXT'], ['cache', 'EXPERT CACHE'], ['run', 'RUN IT']];

/** Plate header (chip glyph, plate label typed on, progress cells) and the hardware footer. */
export const Chrome: React.FC<{t: number; si: number; t0: number; tag?: string}> = ({t, si, t0, tag}) => {
  const v = useV();
  return (
    <>
      <div style={{position: 'absolute', left: M, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
        <Glyph rows={CHIP} cell={6} color={P.cobalt} />
        <Lab><TypeOn text={tag ?? `PLATE 0${si + 1} · ${CHAPTERS[si][1]}`} t={t} t0={t0} /></Lab>
      </div>
      {si >= 0 && (
        <div style={{position: 'absolute', right: M, top: 38, display: 'flex', gap: 8}}>
          {CHAPTERS.map((_, i) => <div key={i} style={{width: 20, height: 20, boxSizing: 'border-box', background: i <= si ? P.cobalt : 'transparent', border: i <= si ? 'none' : `2px solid ${P.rule}`}} />)}
        </div>
      )}
      <div style={{position: 'absolute', left: M, right: M, top: 96, height: 2, background: P.rule}} />
      <div style={{position: 'absolute', left: M, right: M, top: v ? 1472 : 1000, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
        {v ? (
          <>
            <Lab>{HW1}</Lab>
            <Lab style={{marginTop: 8}}>{HW2}</Lab>
          </>
        ) : <Lab>{`${HW1} · ${HW2}`}</Lab>}
      </div>
    </>
  );
};

/** The house arrow: Stem 7's own → (8 cells, centred on the bar row), in cobalt, so it scales with the figures. */
export const Arr: React.FC<{size: number; t?: number; t0?: number}> = ({size, t = 99, t0 = 0}) => {
  const n = Math.max(0, Math.min(8, Math.floor((t - t0) / 0.03)));
  return <span style={{...px(size, P.cobalt), display: 'inline-block', clipPath: `inset(0 ${((8 - n) / 8) * 100}% 0 0)`}}>→</span>;
};

/** A row of whole cells (GiB, steps…), each cell one unit; a partial last cell shows the fraction. */
export const CellBar: React.FC<{n: number; of: number; cell: number; h: number; gap?: number; fill?: string}> = ({n, of, cell, h, gap = 8, fill = P.cobalt}) => (
  <div style={{display: 'flex', gap}}>
    {Array.from({length: of}, (_, i) => {
      const k = Math.max(0, Math.min(1, n - i));
      return (
        <div key={i} style={{width: cell, height: h, boxSizing: 'border-box', border: `2px solid ${k > 0 ? fill : P.rule}`, position: 'relative'}}>
          {k > 0 && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.round(k * (cell - 4)), background: fill}} />}
        </div>
      );
    })}
  </div>
);

const MARK = ['...X...', '...X...', '...X...', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXX..X'];
/** The dh pixel mark in the current ink (house Mark is light-only). */
export const Mark: React.FC<{cell: number}> = ({cell}) => {
  const pts = MARK.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  return <svg width={cell * 7} height={cell * 7} shapeRendering="crispEdges">{pts.map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={P.ink} />)}</svg>;
};

/**
 * Line chart, drawn on: each series is a polyline revealed to fraction k of its length, square markers once the line reaches them.
 * x and y are data units; the y axis starts at 0 (gridlines every `ystep`). Labels in Stem 7 32, recessive axes.
 */
export type Series = {pts: number[][]; color: string; k: number; label?: string; dash?: boolean};
export const LinePlot: React.FC<{w: number; h: number; xmax: number; ymax: number; ystep: number; xticks: [number, string][]; series: Series[]; valueAt?: (s: Series, i: number) => string | null}> = ({w, h, xmax, ymax, ystep, xticks, series, valueAt}) => {
  const L = 96, R = 24, T = 56, B = 64;
  const X = (x: number) => L + (x / xmax) * (w - L - R);
  const Y = (y: number) => T + (1 - y / ymax) * (h - T - B);
  const txt = (s: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', color: string = P.muted) => <text x={x} y={y} textAnchor={anchor} style={{fontFamily: STEM, fontSize: 32, fill: color} as React.CSSProperties}>{s}</text>;
  return (
    <svg width={w} height={h} style={{display: 'block', overflow: 'visible'}}>
      {Array.from({length: Math.floor(ymax / ystep) + 1}, (_, i) => i * ystep).map((y) => (
        <g key={y}><line x1={L} x2={w - R} y1={Y(y)} y2={Y(y)} stroke={y === 0 ? P.ink : P.faint} strokeWidth={2} />{txt(String(y), L - 20, Y(y) + 12, 'end')}</g>
      ))}
      {xticks.map(([x, s]) => <g key={s}>{txt(s, X(x), h - 12, 'middle')}</g>)}
      {series.map((s, si) => {
        const P2 = s.pts.map(([x, y]) => [X(x), Y(y)]);
        const segs = P2.slice(1).map((p, i) => Math.hypot(p[0] - P2[i][0], p[1] - P2[i][1]));
        const total = segs.reduce((a, b) => a + b, 0);
        let left = total * Math.max(0, Math.min(1, s.k));
        const shown: number[][] = [P2[0]];
        const reached: boolean[] = [s.k > 0];
        segs.forEach((len, i) => {
          if (left <= 0) { reached.push(false); return; }
          const f = Math.min(1, left / len);
          shown.push([P2[i][0] + (P2[i + 1][0] - P2[i][0]) * f, P2[i][1] + (P2[i + 1][1] - P2[i][1]) * f]);
          reached.push(f >= 1); left -= len;
        });
        return (
          <g key={si}>
            <polyline points={shown.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={6} strokeLinejoin="miter" strokeDasharray={s.dash ? '12 10' : undefined} />
            {P2.map((p, i) => reached[i] && (
              <g key={i}>
                <rect x={p[0] - 10} y={p[1] - 10} width={20} height={20} fill={s.color} stroke={P.paper} strokeWidth={2} />
                {valueAt && valueAt(s, i) && txt(valueAt(s, i) as string, p[0] + (i === 0 ? 0 : 0), p[1] - 24, i === 0 ? 'start' : i === P2.length - 1 ? 'end' : 'middle', P.ink)}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

/** Vertical bars from a zero baseline, each built in whole cells (one cell = `unit`), the top cell partial. */
export const CellColumns: React.FC<{w: number; h: number; ymax: number; unit: number; bars: {v: number; k: number; hot?: boolean; top: string; under: string; under2?: string}[]; refY?: {v: number; label: string}}> = ({w, h, ymax, unit, bars, refY}) => {
  const B = 96, T = 64;
  const ph = h - T - B;
  const n = bars.length;
  const gap = 32;
  const bw = Math.floor((w - gap * (n - 1)) / n);
  const cellH = (unit / ymax) * ph;
  const lab = (s: string, x: number, y: number, color: string = P.muted) => <text x={x} y={y} textAnchor="middle" style={{fontFamily: STEM, fontSize: 32, fill: color} as React.CSSProperties}>{s}</text>;
  return (
    <svg width={w} height={h} style={{display: 'block', overflow: 'visible'}} shapeRendering="crispEdges">
      {bars.map((b, i) => {
        const x = i * (bw + gap);
        const val = b.v * Math.max(0, Math.min(1, b.k));
        const full = Math.floor(val / unit);
        const part = val / unit - full;
        const fill = b.hot ? P.cobalt : P.rule;
        const cells = Array.from({length: full}, (_, c) => <rect key={c} x={x} y={T + ph - (c + 1) * cellH + 2} width={bw} height={cellH - 4} fill={fill} />);
        if (part > 0.02) cells.push(<rect key="p" x={x} y={T + ph - full * cellH - part * cellH + 2} width={bw} height={Math.max(0, part * cellH - 4)} fill={fill} />);
        return (
          <g key={i}>
            {cells}
            {b.k >= 1 && (refY && b.v < refY.v ? lab(b.top, x + bw / 2, T + ph - (b.v / ymax) * ph + 48, P.ink) : lab(b.top, x + bw / 2, T + ph - (b.v / ymax) * ph - 20, P.ink))}
            {lab(b.under, x + bw / 2, h - 52)}
            {b.under2 && lab(b.under2, x + bw / 2, h - 12, b.hot ? P.cobaltText : P.muted)}
          </g>
        );
      })}
      <line x1={0} x2={w} y1={T + ph} y2={T + ph} stroke={P.ink} strokeWidth={2} />
      {refY && (() => {
        const ry = T + ph - (refY.v / ymax) * ph;
        return <line x1={0} x2={w} y1={ry} y2={ry} stroke={P.ink} strokeWidth={4} strokeDasharray="16 12" />;
      })()}
    </svg>
  );
};
