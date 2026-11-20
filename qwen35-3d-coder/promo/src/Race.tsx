import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import raceJson from './race.json';
import PAL from './palette.json';

// Side-by-side time-lapse: the same prompt sent to the stock and the tuned server on one RTX 3060.
// Every number on screen comes from race.json (tools/prep.py, from the timed captures). Both sides run on one clock,
// sped up by the same factor, so the gap at the finish is the real gap.

/* eslint-disable @typescript-eslint/no-explicit-any */
const R = raceJson as any;
type Side = {
  label: string; dir: string; title: string; total_s: number; first_content_t: number; tokens: number; tps: number;
  content: string; reasoning: string; html_start: number; levels: number[]; mesh_t: number[]; dt: number;
  series: [number, number, number, number][]; user: string;
};
const BASE: Side = R.sides.baseline, TUNED: Side = R.sides.tuned;

export const FPS = 60;
export const TOTAL = 30;
const INTRO = 1.5;                       // title before the race starts
const LONGEST = Math.max(BASE.total_s, TUNED.total_s);
export const SPEED = Math.ceil(LONGEST / 21);   // both sides finish inside ~21 s of video
const RACE_END = INTRO + LONGEST / SPEED;
const CARD = 26;                         // the dh card, same close as the Flint and selfheal videos

export type Theme = 'light' | 'dark';
const P: typeof PAL.light = {...PAL.light};
const MONO = '"IBM Plex Mono", monospace', STEM = '"Stem 7", monospace', HOOP = '"Hoop", sans-serif';
const FACES = [
  ['IBM Plex Mono', 'IBMPlexMono-normal-400.woff2', '400'],
  ['IBM Plex Mono', 'IBMPlexMono-normal-600.woff2', '600'],
  ['Stem 7', 'Stem7-Regular.woff2', '400'],
  ['Hoop', 'Hoop-Bold.woff2', '700'],
] as const;
const useFonts = () => {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(FACES.map(([fam, file, weight]) => {
      const f = new FontFace(fam, `url(${staticFile('fonts/' + file)})`, {weight, style: 'normal'});
      (document.fonts as unknown as Set<FontFace>).add(f);
      return f.load();
    })).then(() => continueRender(h));
  }, [h]);
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmt = (n: number) => n.toLocaleString('en-US');
const lastLines = (s: string, n: number) => s.split('\n').slice(-n);

// ---------- one side of the race ----------

const Panel: React.FC<{s: Side; rt: number; tuned: boolean; w: number; lines: number; v: boolean}> = ({s, rt, tuned, w, lines, v}) => {
  const h = Math.round(w * 9 / 16);
  const done = rt >= s.total_s;
  const r = Math.min(rt, s.total_s);
  const i = Math.max(0, Math.min(s.series.length - 1, Math.floor(r / s.dt)));
  const [, ntok, cc, rc] = s.series[i];
  const back = Math.max(0, i - Math.round(4 / s.dt));
  const live = (ntok - s.series[back][1]) / Math.max(s.dt, (i - back) * s.dt);
  const nMesh = done ? Infinity : s.mesh_t.filter((x) => x <= r).length;
  let k = 0;
  s.levels.forEach((lv, j) => { if (lv <= nMesh) k = j; });
  const thinking = r < s.first_content_t;
  const phase = done ? 'DONE' : rt <= 0 ? 'READY' : thinking ? 'THINKING' : 'WRITING CODE';
  const tick = thinking ? lastLines(s.reasoning.slice(0, rc), lines) : lastLines(s.content.slice(0, cc), lines);
  const stem = (size: number, color = P.ink): React.CSSProperties => ({fontFamily: STEM, fontSize: size, lineHeight: `${size}px`, color, whiteSpace: 'pre'});
  return (
    <div style={{width: w, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0}}>
      <div style={{position: 'relative', width: w, height: h, outline: `2px solid ${P.ink}`, background: P.sheet, overflow: 'hidden'}}>
        <Img src={staticFile(`${s.dir}/s${s.levels[k]}.png`)} style={{width: w, height: h, display: 'block'}} />
        {done && (
          <div style={{position: 'absolute', right: 24, bottom: 24, padding: '16px 24px', background: tuned ? P.vermilion : P.paper,
            outline: tuned ? 'none' : `2px solid ${P.ink}`, ...stem(48, '#16181d'), color: tuned ? '#16181d' : P.ink}}>
            {`DONE ${clock(s.total_s)}`}
          </div>
        )}
      </div>
      <div style={{height: 8, background: P.faint}}>
        <div style={{height: 8, width: `${(100 * ntok) / s.tokens}%`, background: P.cobalt}} />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
        <div>
          <div style={stem(48)}>{tuned ? 'TUNED' : 'STOCK'}</div>
          <div style={{fontFamily: MONO, fontSize: 20, lineHeight: '24px', color: P.muted, marginTop: 12}}>
            {tuned ? 'Q5_K_M · f16 KV · -ub 2048' : 'Q8_0 · default flags'}
          </div>
        </div>
        <div style={stem(72)}>{clock(r)}</div>
      </div>
      <div style={{display: 'flex', gap: 32, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
        <div style={stem(32, P.cobaltText)}>{phase}</div>
        <div style={{flex: 1}} />
        <div style={stem(32)}>{`${done ? s.tps.toFixed(1) : ntok > 0 ? live.toFixed(1) : '0.0'} TOK/S`}</div>
        <div style={stem(32, P.muted)}>{fmt(ntok)}</div>
      </div>
      <div style={{fontFamily: MONO, fontSize: 16, lineHeight: '24px', height: lines * 24, overflow: 'hidden', color: thinking && !done ? P.muted : P.ink,
        background: P.sheet, padding: '8px 16px', boxSizing: 'content-box'}}>
        {tick.map((l, j) => <div key={j} style={{whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis'}}>{l || ' '}</div>)}
      </div>
    </div>
  );
};

// ---------- the dh card (same close as the selfheal and Flint videos) ----------

const DH = ['...X...', '...X...', '...X...', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXX..X'];
const CHIP = ['.X.X.', 'XXXXX', 'XX.XX', 'XXXXX', '.X.X.'];
const pix = (rows: string[]) => rows.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
const DhCard: React.FC<{t: number}> = ({t}) => {
  const pts = pix(DH);
  pts.sort((a, b) => (a[0] === 3 && b[0] !== 3 ? -1 : b[0] === 3 && a[0] !== 3 ? 1 : a[1] - b[1] || a[0] - b[0]));
  const n = Math.max(0, Math.min(21, Math.floor((t - CARD) / 0.05) + 1));
  const cell = 48;
  return (
    <AbsoluteFill style={{background: P.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <svg width={cell * 7} height={cell * 7} shapeRendering="crispEdges">
        {pts.slice(0, n).map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={P.ink} />)}
      </svg>
      <div style={{textAlign: 'center', opacity: t >= CARD + 1.2 ? 1 : 0}}>
        <div style={{fontFamily: HOOP, fontWeight: 700, fontSize: 56, lineHeight: '64px', color: P.ink}}>David Hatley</div>
        <div style={{fontFamily: MONO, fontSize: 28, lineHeight: '36px', letterSpacing: '0.04em', color: P.muted, marginTop: 12}}>design · AI/ML · generative tools</div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 48}}>
          <svg width={30} height={30} shapeRendering="crispEdges">
            {pix(CHIP).map(([x, y]) => <rect key={`${x}-${y}`} x={x * 6} y={y * 6} width={6} height={6} fill={P.cobalt} />)}
          </svg>
          <span style={{fontFamily: MONO, fontSize: 28, lineHeight: '36px', color: P.ink}}>github.com/davidghatley/3060-recipes</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- composition ----------

const Race: React.FC<{theme: Theme}> = ({theme}) => {
  Object.assign(P, PAL[theme]);
  useFonts();
  const {width, height} = useVideoConfig();
  const v = height > width;
  const t = useCurrentFrame() / FPS;
  if (t >= CARD) return <DhCard t={t} />;
  const rt = (t - INTRO) * SPEED;
  const m = v ? 40 : 48;
  const w = v ? width - 2 * m : (width - 3 * m) / 2;
  const ratio = BASE.tokens && TUNED.tps / BASE.tps;
  const result = t >= RACE_END + 0.4;
  const stem = (size: number, color = P.ink): React.CSSProperties => ({fontFamily: STEM, fontSize: size, lineHeight: `${size}px`, color, whiteSpace: 'pre'});
  return (
    <AbsoluteFill style={{background: P.paper, padding: m, display: 'flex', flexDirection: 'column', gap: v ? 32 : 24}}>
      <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${P.ink}`, paddingBottom: 16}}>
        <div style={stem(32)}>{v ? 'QWEN3.5-4B 3D-CODER' : 'QWEN3.5-4B 3D-CODER · ONE RTX 3060'}</div>
        <div style={stem(32, P.cobaltText)}>{`TIMELAPSE ×${SPEED}`}</div>
      </div>
      <div style={{fontFamily: MONO, fontSize: 20, lineHeight: '24px', color: P.muted, height: 24, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>
        {result
          ? `Same prompt, same GPU. Decode ${BASE.tps.toFixed(1)} → ${TUNED.tps.toFixed(1)} tok/s, ${ratio.toFixed(2)}× faster.`
          : `Prompt: ${TUNED.title}. Both servers write the whole three.js page from scratch.`}
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', gap: v ? 32 : m}}>
        <Panel s={BASE} rt={rt} tuned={false} w={w} lines={v ? 2 : 5} v={v} />
        <Panel s={TUNED} rt={rt} tuned w={w} lines={v ? 2 : 5} v={v} />
      </div>
    </AbsoluteFill>
  );
};

export const RaceLight: React.FC = () => <Race theme="light" />;
export const RaceDark: React.FC = () => <Race theme="dark" />;
