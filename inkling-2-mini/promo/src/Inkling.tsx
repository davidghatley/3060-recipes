import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  Arr, CHIP, CREDITS, CellBar, D, Glyph, HOOP, HW1, HW2, LOOP_N, Lab, MODEL, MONO, Mark, P, Px, QUANT, R, S, SIZE, STATUS, TBD, type Theme, TypeOn,
  URL, carry, cells, count, ctxLabel, fmt, has, mono, on, rise, setTheme, show, useFonts, useV, xfmt,
} from './kit';
import {LoopFigure, loopEnd} from './Loop';

// Inkling-2-Mini on a 3060: the Flint v3 poster layout (flint/promo/src/v3/Plates.tsx) on a new story.
//   01 a 32 GB+ model in a 12 GB card · 02 the loop · 03 stock vs tuned · 04 the flags · 05 what fits · 06 run it · dh card.
// Every number comes from data.json; nulls print as a dash and every header says DRAFT until the run lands.

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
type SceneP = {t: number};
const M = D.model;

// ---------- chrome ----------
export const M_ = 48;
const body = (v: boolean) => (v ? {top: 128, bottom: 1448} : {top: 128, bottom: 976});
const Body: React.FC<{children: React.ReactNode; align?: 'center' | 'top'}> = ({children, align = 'center'}) => {
  const v = useV();
  const {top, bottom} = body(v);
  return (
    <div style={{position: 'absolute', left: M_, right: M_, top, height: bottom - top, display: 'flex', flexDirection: 'column', justifyContent: align === 'top' ? 'flex-start' : 'center'}}>
      <div>{children}</div>
    </div>
  );
};
const CHAPTERS: [string, string][] = [['hook', '12 GB CARD'], ['loop', 'THE LOOP'], ['speed', 'STOCK VS TUNED'], ['flags', 'THE FLAGS'], ['fit', 'WHAT FITS'], ['run', 'RUN IT']];
const Chrome: React.FC<{t: number; si: number; t0: number}> = ({t, si, t0}) => {
  const v = useV();
  return (
    <>
      <div style={{position: 'absolute', left: M_, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
        <Glyph rows={CHIP} cell={6} color={P.cobalt} />
        <Lab><TypeOn text={`PLATE 0${si + 1} · ${CHAPTERS[si][1]} · ${STATUS}`} t={t} t0={t0} /></Lab>
      </div>
      <div style={{position: 'absolute', right: M_, top: 38, display: 'flex', gap: 8}}>
        {CHAPTERS.map((_, i) => <div key={i} style={{width: 20, height: 20, boxSizing: 'border-box', background: i <= si ? P.cobalt : 'transparent', border: i <= si ? 'none' : `2px solid ${P.rule}`}} />)}
      </div>
      <div style={{position: 'absolute', left: M_, right: M_, top: 96, height: 2, background: P.rule}} />
      <div style={{position: 'absolute', left: M_, right: M_, top: v ? 1472 : 1000, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
        {v ? <><Lab>{HW1}</Lab><Lab style={{marginTop: 8}}>{HW2}</Lab></> : <Lab>{`${HW1} · ${HW2}`}</Lab>}
      </div>
    </>
  );
};

// ---------- 01 · a 32 GB+ model, a 12 GB card ----------
const Hook: React.FC<SceneP> = ({t}) => {
  const h = tl.hook;
  const v = useV();
  const strike = carry(t, h.strike, 0.35);
  const vram = R.vram_gib as number | null;
  return (
    <Body>
      <div style={rise(t, h.head)}>
        <Lab color={P.cobaltText}>{`${SIZE} MOE · LLAMA.CPP · ${QUANT} · ${has(R.ctx) ? ctxLabel(R.ctx) + ' CTX' : TBD + ' CTX'}`}</Lab>
        <Px size={v ? S.m : S.l} style={{marginTop: 24, whiteSpace: 'pre-wrap', lineHeight: v ? '64px' : '88px'}}>{v ? `${MODEL}\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Px>
      </div>
      <div style={{display: v ? 'block' : 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 64, marginTop: v ? 56 : 64}}>
        <div style={{borderTop: `4px solid ${P.ink}`, paddingTop: 24, ...show(t, h.need)}}>
          <Lab>THE USUAL ADVICE</Lab>
          <div style={{position: 'relative', display: 'inline-block', marginTop: 24}}>
            <Px size={S.x240} color={P.muted}>{`${M.needs_gb}+`}</Px>
            <div style={{position: 'absolute', left: -8, top: 104, height: 24, width: `calc(${strike * 100}% + 16px)`, background: P.ink}} />
          </div>
          <Lab style={{marginTop: 24}}>GB OF VRAM</Lab>
        </div>
        <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 24, marginTop: v ? 48 : 0, ...show(t, h.fits)}}>
          <Lab color={P.cobaltText}>THIS RECIPE · VRAM USED</Lab>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 32, marginTop: 24}}>
            <Px size={S.x240}>{has(vram) ? count(vram, t, h.fits, 1, 0, 0.5) : TBD}</Px>
            <Px size={S.l} color={P.muted} style={{marginTop: 24}}>GB</Px>
          </div>
          <div style={{marginTop: 24}}><CellBar n={has(vram) ? vram * carry(t, h.cells, 0.8) : null} of={12} cell={v ? 72 : 60} h={48} gap={8} /></div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · the loop ----------
const Loop: React.FC<SceneP> = ({t}) => {
  const l = tl.loop;
  const v = useV();
  const tm = {go: l.go, pre: l.pre, pass: l.pass, back: l.back};
  const end = loopEnd(tm);
  const facts: [string, string][] = [
    ['WEIGHTS', `${M.total_b}B`], ['ACTIVE / TOKEN', `${M.active_b}B`], ['ATTENTION', 'SLIDING + GLOBAL'], ['CONTEXT', `${M.ctx_max} TOKENS`],
  ];
  return (
    <Body>
      <Px size={v ? S.m : S.l} style={{whiteSpace: 'pre-wrap', lineHeight: v ? '64px' : '88px', ...rise(t, l.in)}}>{v ? `The same ${LOOP_N} layers\nrun ${M.loop_times} times` : `The same ${LOOP_N} layers run ${M.loop_times} times`}</Px>
      <div style={{marginTop: v ? 48 : 40, ...show(t, l.build)}}>
        <LoopFigure t={t} tm={tm} cw={v ? 30 : 48} ch={v ? 120 : 144} gap={v ? 4 : 8} gg={v ? 24 : 56} big={v ? S.l : S.xl} loopH={v ? 72 : 88} ends={!v} />
      </div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : 'repeat(4, max-content)', columnGap: 80, rowGap: 24, marginTop: v ? 56 : 48, ...show(t, Math.min(end + 0.2, l.stats))}}>
        {facts.map(([k, val], i) => (
          <div key={k} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16, ...show(t, Math.min(end + 0.2, l.stats) + i * 0.12)}}>
            <Lab>{k}</Lab>
            <Px size={S.m} style={{marginTop: 12}}>{val}</Px>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 03 · stock vs tuned ----------
const Speed: React.FC<SceneP> = ({t}) => {
  const s = tl.speed;
  const v = useV();
  const a = R.baseline_tps as number | null, z = R.tuned_tps as number | null;
  const max = Math.max(a ?? 0, z ?? 0) || 1;
  const k = carry(t, s.nums + 0.3, 0.8);
  const bar = (val: number | null, fill: string, kk: number) => (
    <div style={{height: 24, width: has(val) ? `${((val as number) / max) * 100 * kk}%` : '100%', background: has(val) ? fill : 'transparent', border: has(val) ? 'none' : `2px dashed ${P.rule}`, boxSizing: 'border-box'}} />
  );
  const big = v ? S.xl : S.x240;
  return (
    <Body>
      <Px size={v ? S.m : S.l} style={rise(t, s.in)}>Stock flags vs tuned</Px>
      <div style={{position: 'relative', borderTop: `4px solid ${P.ink}`, marginTop: v ? 32 : 40, paddingTop: 24}}>
        <Lab>DECODE · TOK/S</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 32 : 60, marginTop: 32, flexWrap: v ? 'wrap' : 'nowrap'}}>
          <Px size={big} color={P.muted} style={show(t, s.nums)}>{fmt(a, 1)}</Px>
          <Arr size={big} t={t} t0={s.nums + 0.15} />
          <Px size={big} style={show(t, s.nums + 0.35)}>{count(z, t, s.nums + 0.35, 1, a ?? 0)}</Px>
        </div>
        {v && <Px size={S.x240} color={P.vermilion} style={{marginTop: 40, ...show(t, s.delta)}}>{xfmt(R.speedup)}</Px>}
        <div style={{display: 'grid', gap: 16, marginTop: 40, ...show(t, s.nums)}}>
          <div style={{display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: 24}}><Lab>STOCK</Lab>{bar(a, P.rule, 1)}</div>
          <div style={{display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: 24}}><Lab color={P.ink}>TUNED</Lab>{bar(z, P.cobalt, has(a) ? (a as number) / max + (1 - (a as number) / max) * k : k)}</div>
        </div>
      </div>
      <div style={{borderTop: `2px solid ${P.rule}`, marginTop: 48, paddingTop: 24, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', ...show(t, s.pp)}}>
        <Lab>{`PREFILL · TOK/S${has(R.prefill_prompt) ? ' · ' + ctxLabel(R.prefill_prompt) + ' PROMPT' : ''}`}</Lab>
        {has(R.baseline_prefill_tps) && <><Px size={S.l} color={P.muted}>{fmt(R.baseline_prefill_tps)}</Px><Arr size={S.l} /></>}
        <Px size={S.l}>{fmt(R.prefill_tps)}</Px>
        {!v && <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24, ...show(t, s.delta)}}><Lab>DECODE</Lab><Px size={S.xl} color={P.vermilion}>{xfmt(R.speedup)}</Px></div>}
      </div>
    </Body>
  );
};

// ---------- 04 · the flags ----------
const Flags: React.FC<SceneP> = ({t}) => {
  const f = tl.flags;
  const v = useV();
  const rows: {flag: string; note: string | null}[] = (R.flags as any[] | null)?.slice(0, 5) ?? Array.from({length: 4}, () => ({flag: 'TBD', note: null}));
  return (
    <Body>
      <Px size={v ? S.m : S.l} style={{whiteSpace: 'pre-wrap', lineHeight: v ? '64px' : '88px', ...rise(t, f.in)}}>{has(R.flags) ? `${rows.length} flags + 2 engine patches` : 'The flags'}</Px>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: 40}}>
        {rows.map((r, i) => {
          const t0 = f.rows + i * 0.3;
          return (
            <div key={i} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr max-content', columnGap: 48, rowGap: 12, alignItems: 'center', padding: v ? '24px 0' : '20px 0', borderBottom: `2px solid ${P.faint}`}}>
              <div style={mono(v ? 32 : 48, P.cobaltText, 600)}><TypeOn text={r.flag} t={t} t0={t0} rate={0.012} /></div>
              <Px size={v ? S.m : S.l} color={P.ink} style={{justifySelf: v ? 'start' : 'end', ...show(t, t0 + 0.25)}}>{r.note ?? TBD}</Px>
            </div>
          );
        })}
      </div>
    </Body>
  );
};

// ---------- 05 · what fits ----------
const Fit: React.FC<SceneP> = ({t}) => {
  const f = tl.fit;
  const v = useV();
  const stats: [string, string, string][] = [
    ['CONTEXT', ctxLabel(R.ctx), `OF ${M.ctx_max} MAX`],
    ['VRAM', has(R.vram_gib) ? fmt(R.vram_gib, 1) : TBD, 'GB OF 12'],
    ['QUANT', has(R.quant) ? String(R.quant) : TBD, has(R.file_gb) ? `${fmt(R.file_gb, 1)} GB FILE` : 'GGUF'],
    ['MEAN KLD', has(R.kld) ? fmt(R.kld, 3) : TBD, has(R.kld_ref) ? `VS ${String(R.kld_ref).toUpperCase()}` : 'VS FULL PRECISION'],
  ];
  return (
    <Body>
      <Px size={v ? S.m : S.l} style={rise(t, f.in)}>What fits in 12 GB</Px>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr', columnGap: 64, rowGap: v ? 32 : 48, marginTop: v ? 40 : 48}}>
        {stats.map(([k, val, sub], i) => (
          <div key={k} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, f.stats + i * 0.25)}}>
            <Lab>{k}</Lab>
            <Px size={S.xl} style={{marginTop: 24}}>{val}</Px>
            <Lab style={{marginTop: 24}}>{sub}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const Run: React.FC<SceneP> = ({t}) => {
  const r = tl.run;
  const v = useV();
  const gguf = has(R.gguf) ? String(R.gguf).split('/').pop() : `Inkling-2-Mini-${has(R.quant) ? R.quant : 'TBD'}.gguf`;
  const cmd: string[] = has(R.cmd) ? (R.cmd as string[]) : [`llama-server -m ${gguf} \\`, has(R.flags) ? `  ${(R.flags as any[]).map((f) => f.flag).join(' ')}` : '  TBD: flags land with the tuning run'];
  const k = carry(t, r.cmd, 0.5);
  const box = (
    <div style={{background: P.sheet, outline: `2px solid ${P.ink}`, padding: v ? '20px 24px' : '24px 32px', clipPath: k >= 1 ? 'none' : `inset(-4px ${(1 - k) * 100}% -4px -4px)`}}>
      {cmd.map((l, i) => <div key={i} style={{...mono(v ? 32 : 48), whiteSpace: 'pre-wrap'}}><TypeOn text={l} t={t} t0={r.cmd + 0.2 + i * 0.15} rate={0.006} /></div>)}
    </div>
  );
  return (
    <Body>
      <Px size={S.l} color={P.cobalt} style={{whiteSpace: 'pre', lineHeight: '88px', ...show(t, r.cmd + 0.6)}}>{v ? 'github.com/\ndavidghatley/\n3060-recipes' : URL}</Px>
      <div style={{marginTop: v ? 32 : 40}}>{box}</div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr', columnGap: 48, rowGap: 24, marginTop: v ? 40 : 48}}>
        {CREDITS.map(([key, val], i) => (
          <div key={key} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16, ...show(t, r.credits + i * 0.2)}}>
            <Lab>{key}</Lab>
            <Px size={S.label} style={{marginTop: 12}}>{val}</Px>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- the dh card (same close as the Flint and selfheal videos) ----------
const DhCard: React.FC<{t: number}> = ({t}) => {
  const t0 = tl.end.dh;
  return (
    <AbsoluteFill style={{background: P.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <Mark cell={48} n={cells(t, t0, 21, 0.05)} />
      <div style={{textAlign: 'center', opacity: on(t, t0 + 1.2) ? 1 : 0}}>
        <div style={{fontFamily: HOOP, fontWeight: 700, fontSize: 56, lineHeight: '64px', color: P.ink}}>David Hatley</div>
        <div style={{fontFamily: MONO, fontSize: 28, lineHeight: '36px', letterSpacing: '0.04em', color: P.muted, marginTop: 12}}>design · AI/ML · generative tools</div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 48}}>
          <Glyph rows={CHIP} cell={6} />
          <span style={{fontFamily: MONO, fontSize: 28, lineHeight: '36px', color: P.ink}}>{URL}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- composition ----------
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['loop', Loop], ['speed', Speed], ['flags', Flags], ['fit', Fit], ['run', Run]];
const Launch: React.FC<{theme?: Theme}> = ({theme = 'light'}) => {
  setTheme(theme);
  useFonts();
  const t = useCurrentFrame() / FPS;
  if (t >= tl.end.dh) return <DhCard t={t} />;
  const idx = SCENES.reduce((acc, [k], i) => (t >= tl[k].in ? i : acc), 0);
  const Scene = SCENES[idx][1];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Chrome t={t} si={idx} t0={idx === 0 ? -1 : tl[SCENES[idx][0]].in} />
      <Scene t={t} />
    </AbsoluteFill>
  );
};
export const InklingLight: React.FC = () => <Launch theme="light" />;
export const InklingDark: React.FC = () => <Launch theme="dark" />;
