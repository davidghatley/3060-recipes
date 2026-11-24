import React, {useEffect, useState} from 'react';
import {Easing, continueRender, delayRender, staticFile, useVideoConfig} from 'remotion';
import dataJson from './data.json';
import PAL from './palette.json';

// SenseNova-Loop-9B promo kit, from the Maxwell-V1-Flash kit (maxwell-v1-flash/promo/src/kit.tsx), itself from the Inkling-2-Mini uncensored kit (inkling-2-mini-uncensored/promo/src/kit.tsx), itself from the Qwen3.8-27B family kit (qwen38-27b-family/promo/src/kit.tsx), itself from the Inkling promo kit (inkling-2-mini/promo/src/kit.tsx), itself the Flint v3 kit (flint/promo/src/v3/kit.tsx) and house motion (flint/promo/src/house.tsx),
// trimmed to what this video uses and made standalone (no import from flint's kit/).
// Every number comes from data.json (tools/prep.py, from ../promo-data.json). A null prints as a dash.

/* eslint-disable @typescript-eslint/no-explicit-any */
export const D = dataJson as any;
export const DRAFT = D.status !== 'measured';

/** Light = Plaster, dark = Night, from secret-sauce tokens.json (tools/sauce_palette.py). */
export type Theme = 'light' | 'dark';
export const P: typeof PAL.light = {...PAL.light};
export const setTheme = (th: Theme) => { Object.assign(P, PAL[th]); };

/**
 * Stem 7 steps: 32 · 48 · 72 · 120. The one oversize step, 240, is the Flint promo's approved headline size
 * (2 × 120, still whole 30 px cells), used here only for the headline numerals.
 */
export const S = {
  label: 32,
  m: 48,
  l: 72,
  xl: 120,
  /* sauce-lint allow-next-line type-scale: approved oversize Stem 7 (Flint promo family); 2 x 120, 30 px cells */
  x240: 240,
} as const;

export const MONO = '"IBM Plex Mono", monospace';
export const STEM = '"Stem 7", monospace';
export const HOP = '"Hopscotch", sans-serif';
export const TICK = '"Tick 35", monospace';
const FACES = [
  ['IBM Plex Mono', 'IBMPlexMono-normal-400.woff2', '400'],
  ['IBM Plex Mono', 'IBMPlexMono-normal-600.woff2', '600'],
  ['Stem 7', 'Stem7-Regular.woff2', '400'],
  ['Hopscotch', 'Hopscotch-Regular.woff2', '400'],
  ['Tick 35', 'Tick35-Regular.woff2', '400'],
] as const;
export const useFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
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

// ---------- numbers (null -> placeholder) ----------
export const TBD = '—';
export const has = (n: unknown) => n !== null && n !== undefined;
export const fmt = (n: number | null | undefined, dp = 0) => (has(n) ? (n as number).toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp}) : TBD);
export const xfmt = (n: number | null | undefined) => (has(n) ? `${(n as number).toFixed(1)}×` : `${TBD}×`);
export const ctxLabel = (n: number | null | undefined) => {
  if (!has(n)) return TBD;
  const v = n as number;
  if (v >= 1024 * 1024) return `${+(v / 1048576).toFixed(1)}M`;
  if (v >= 1024) return `${Math.round(v / 1024)}K`;
  return String(v);
};
/** A whole-number step count from `from` to `to` (built, not carried). */
export const count = (to: number | null, t: number, t0: number, dp = 0, from = 0, dur = 0.6) => {
  if (!has(to)) return TBD;
  const k = Math.min(1, Math.max(0, (t - t0) / dur));
  return fmt(from + ((to as number) - from) * (Math.floor(k * 12) / 12), dp);
};

// ---------- house motion: carried things ease once, built things step in cells ----------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const carry = (t: number, t0: number, dur = 0.6) => easeInOut(clamp01((t - t0) / dur));
export const arrive = (t: number, t0: number, dur = 0.6) => easeOut(clamp01((t - t0) / dur));
export const cells = (t: number, t0: number, n: number, step = 0.07) => Math.max(0, Math.min(n, Math.floor((t - t0) / step) + 1));
export const on = (t: number, t0: number) => t >= t0;
export const show = (t: number, t0: number): React.CSSProperties => ({opacity: on(t, t0) ? 1 : 0});
export const rise = (t: number, t0: number): React.CSSProperties => ({opacity: arrive(t, t0, 0.4), transform: `translateY(${Math.round((1 - arrive(t, t0, 0.4)) * 16)}px)`});

/** Text typed on, a block cursor cell riding the last letter while it types. */
export const TypeOn: React.FC<{text: string; t: number; t0: number; rate?: number}> = ({text, t, t0, rate = 0.022}) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - t0) / rate)));
  return (
    <span style={{whiteSpace: 'pre'}}>
      {text.slice(0, n)}
      {n > 0 && n < text.length && <span style={{display: 'inline-block', width: '0.375em', height: '0.625em', background: P.cobalt, marginLeft: 2}} />}
      <span style={{opacity: 0}}>{text.slice(n)}</span>
    </span>
  );
};

// ---------- type ----------
export const px = (size: number, color: string = P.ink): React.CSSProperties => ({
  fontFamily: STEM, fontSize: size, lineHeight: `${size}px`, letterSpacing: 0, color, whiteSpace: 'pre',
  fontKerning: 'normal', fontSynthesis: 'none', fontVariantLigatures: 'common-ligatures', WebkitFontSmoothing: 'none',
} as React.CSSProperties);
export const Px: React.FC<{size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({size, color, style, children}) => <div style={{...px(size, color), ...style}}>{children}</div>;
/** Caps label, Stem 7 32 (4 px cells), one cell of tracking. */
export const Lab: React.FC<{color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({color = P.muted, style, children}) => <div style={{...px(S.label, color), letterSpacing: 4, ...style}}>{children}</div>;
export const mono = (size: number, color: string = P.ink, weight = 400): React.CSSProperties => ({fontFamily: MONO, fontWeight: weight, fontSize: size, lineHeight: `${size === 48 ? 64 : size === 32 ? 40 : size + 16}px`, color, whiteSpace: 'pre'});

// ---------- glyphs ----------
/** A 5x5 pantry glyph. CHIP is the 3060-recipes glyph used by the Flint and Qwen promos (proposed, not yet in secret-sauce). */
export const CHIP = ['.X.X.', 'XXXXX', 'XX.XX', 'XXXXX', '.X.X.'];
export const Glyph: React.FC<{rows: string[]; cell: number; color?: string}> = ({rows, cell, color = P.cobalt}) => {
  const pts = rows.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  return <svg width={cell * 5} height={cell * 5} shapeRendering="crispEdges">{pts.map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={color} />)}</svg>;
};
const DH = ['...X...', '...X...', '...X...', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXX..X'];
/** The dh pixel mark in the current ink, built stem first (n cells shown). */
export const Mark: React.FC<{cell: number; n?: number}> = ({cell, n = 99}) => {
  const pts = DH.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  pts.sort((a, b) => (a[0] === 3 && b[0] !== 3 ? -1 : b[0] === 3 && a[0] !== 3 ? 1 : a[1] - b[1] || a[0] - b[0]));
  return <svg width={cell * 7} height={cell * 7} shapeRendering="crispEdges">{pts.slice(0, n).map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={P.ink} />)}</svg>;
};

/** The house arrow: Stem 7's own → in cobalt, drawn on in cells. */
export const Arr: React.FC<{size: number; t?: number; t0?: number}> = ({size, t = 99, t0 = 0}) => {
  const n = Math.max(0, Math.min(8, Math.floor((t - t0) / 0.03)));
  return <span style={{...px(size, P.cobalt), display: 'inline-block', clipPath: `inset(0 ${((8 - n) / 8) * 100}% 0 0)`}}>→</span>;
};

/** A row of whole cells, one per unit; a partial last cell shows the fraction. Unknown n draws empty cells. */
export const CellBar: React.FC<{n: number | null; of: number; cell: number; h: number; gap?: number; fill?: string}> = ({n, of, cell, h, gap = 8, fill = P.cobalt}) => (
  <div style={{display: 'flex', gap}}>
    {Array.from({length: of}, (_, i) => {
      const k = has(n) ? Math.max(0, Math.min(1, (n as number) - i)) : 0;
      return (
        <div key={i} style={{width: cell, height: h, boxSizing: 'border-box', border: `2px solid ${k > 0 ? fill : P.rule}`, position: 'relative'}}>
          {k > 0 && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.round(k * (cell - 4)), background: fill}} />}
        </div>
      );
    })}
  </div>
);

// ---------- type: Hopscotch titles, Tick 35 word labels ----------
/** Title line in Hopscotch (one weight, leans by design). Sizes stay on the type steps. */
export const Hop: React.FC<{size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({size, color = P.ink, style, children}) => (
  <div style={{fontFamily: HOP, fontWeight: 400, fontSynthesis: 'none', fontSize: size, lineHeight: `${Math.round(size * 1.2)}px`, color, whiteSpace: 'pre-wrap', ...style} as React.CSSProperties}>{children}</div>
);
/** Tick 35 word label at 32 px: words only, never numbers (its 8 reads like &). */
export const Tick: React.FC<{color?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({color = P.ink, style, children}) => (
  <div style={{fontFamily: TICK, fontSize: 32, lineHeight: '32px', color, whiteSpace: 'pre', WebkitFontSmoothing: 'none', ...style} as React.CSSProperties}>{children}</div>
);

// ---------- labels shared by the video and the stills ----------
export const ST = D.stock as any;
export const TU = D.tuned as any;
export const CTL = D.controls as any;
export const GR = D.greedy as any;
export const LONG = D.long as any;
export const UNC = D.uncensored as any;
export const DER = D.derived as any;
export const MODEL = 'SenseNova-Loop-9B';
export const SIZE = String(D.model.size).toUpperCase();
export const LOOP = `LAYERS ${D.model.loop} RUN TWICE · ${D.model.passes} PASSES PER TOKEN`;
export const HW1 = 'RTX 3060 12 GB · I5-12500 · 62 GB DDR5';
export const HW2 = `LLAMA.CPP ${String(D.engine.master).toUpperCase()} + PR #${D.engine.pr}`;
export const HW_SHORT = `RTX 3060 12 GB · 62 GB RAM · LLAMA.CPP + PR #${D.engine.pr}`;
export const STATUS = DRAFT ? 'DRAFT' : 'MEASURED';
export const URL = 'github.com/davidghatley/3060-recipes';
export const CREDITS: [string, string][] = [
  ['MODEL · GGUF · MMPROJ', 'SenseNova'],
  ['ABLITERATED GGUF', 'satellitedown'],
  [`PR #${D.engine.pr}`, 'niushengxiao, SenseTime'],
  ['ENGINE', 'llama.cpp, ggml-org'],
  ['METHOD', 'inference-optimisation, 0xSero'],
];
/** percent, rounded half up, with a real minus sign */
export const pct = (n: number | null | undefined) => (has(n) ? `${(n as number) < 0 ? '−' : '+'}${Math.abs(Math.round(n as number))}%` : TBD);
export const ctxK = (n: number) => `${Math.round(n / 1024)}K`;
