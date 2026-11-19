import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {Mask} from '../kit/src/components/primitives';
import {easeInOut, easeOut, prog} from '../kit/src/lib';

// Secret Sauce light inks (docs/plates surface: cobalt + vermilion, vermilion once), same as the napkin launch clip.
export const P = {paper: '#eeede7', sheet: '#f9f9f5', ink: '#16181d', muted: '#555a61', rule: '#c9c9c0', faint: '#e0e0d8', cobalt: '#2236b0', onCobalt: '#f9f9f5', tint: '#dde1f2', vermilion: '#ee5228'};
export const F = {mono: '"IBM Plex Mono", monospace', serif: '"Newsreader", serif', px: '"Stem 7", monospace', text: '"Hoop", sans-serif', tick: '"Tick 35", monospace'};
export const label: React.CSSProperties = {fontFamily: F.tick, fontWeight: 400, fontSize: 25, lineHeight: '32px', letterSpacing: '3px', textTransform: 'uppercase', color: P.muted, whiteSpace: 'pre'};

const FACES = [
  ['IBM Plex Mono', 'IBMPlexMono-normal-400.woff2', '400', 'normal'],
  ['IBM Plex Mono', 'IBMPlexMono-normal-600.woff2', '600', 'normal'],
  ['Newsreader', 'Newsreader-italic-400.woff2', '400', 'italic'],
  ['Stem 7', 'Stem7-Regular.woff2', '400', 'normal'],
  ['Hoop', 'Hoop-Regular.woff2', '400', 'normal'],
  ['Hoop', 'Hoop-Bold.woff2', '700', 'normal'],
  ['Tick 35', 'Tick35-Regular.woff2', '400', 'normal'],
] as const;
export const useHouseFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(FACES.map(([fam, file, weight, style]) => {
      const f = new FontFace(fam, `url(${staticFile('fonts/' + file)})`, {weight, style});
      (document.fonts as unknown as Set<FontFace>).add(f);
      return f.load();
    })).then(() => continueRender(handle));
  }, [handle]);
};

// House motion: carried things ease once, built things step in cells (70 ms).
export const carry = (t: number, t0: number, dur = 0.6) => prog(t, t0, t0 + dur, easeInOut);
export const arrive = (t: number, t0: number, dur = 0.6) => prog(t, t0, t0 + dur, easeOut);
export const cells = (t: number, t0: number, n: number, step = 0.07) => Math.max(0, Math.min(n, Math.floor((t - t0) / step) + 1));
export const on = (t: number, t0: number) => t >= t0;
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Label typed on, a block cursor cell riding the last letter while it types. */
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
/** Running text rising word by word out of its line. */
export const Words: React.FC<{text: string; t: number; t0: number; stagger?: number}> = ({text, t, t0, stagger = 0.04}) => (
  <>
    {text.split(' ').map((w, i, a) => {
      const k = Math.min(1, Math.max(0, (t - t0 - i * stagger) / 0.45));
      return <React.Fragment key={i}><Mask k={1 - Math.pow(1 - k, 4)} tilt={0}>{w}</Mask>{i < a.length - 1 ? ' ' : ''}</React.Fragment>;
    })}
  </>
);
/** A number counting up in whole steps (built, not carried). */
export const Count: React.FC<{to: number; t: number; t0: number; dur?: number; dp?: number; from?: number}> = ({to, t, t0, dur = 0.8, dp = 0, from = 0}) => {
  const k = Math.min(1, Math.max(0, (t - t0) / dur));
  const steps = 12;
  const v = from + (to - from) * (Math.floor(k * steps) / steps);
  return <span>{v.toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp})}</span>;
};

/** A 5x5 pantry glyph built cell by cell. */
export const Glyph: React.FC<{rows: string[]; cell: number; n?: number; color?: string}> = ({rows, cell, n = 99, color = P.cobalt}) => {
  const pts = rows.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  return <svg width={cell * 5} height={cell * 5} shapeRendering="crispEdges">{pts.slice(0, n).map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={color} />)}</svg>;
};
// PROPOSED pantry glyph for 3060-recipes: a chip with pins. Not yet in secret-sauce build.py; replace once approved.
export const CHIP = ['.X.X.', 'XXXXX', 'XX.XX', 'XXXXX', '.X.X.'];

const MARK = ['...X...', '...X...', '...X...', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXX..X'];
/** The dh pixel mark, built stem first. */
export const Mark: React.FC<{cell: number; n?: number}> = ({cell, n = 99}) => {
  const pts = MARK.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  pts.sort((a, b) => (a[0] === 3 && b[0] !== 3 ? -1 : b[0] === 3 && a[0] !== 3 ? 1 : a[1] - b[1] || a[0] - b[0]));
  return <svg width={cell * 7} height={cell * 7} shapeRendering="crispEdges">{pts.slice(0, n).map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={P.ink} />)}</svg>;
};
