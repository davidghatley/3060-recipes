import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  Arr, CHIP, CREDITS, D, DER, Glyph, HOP, HW1, HW2, Hop, Lab, MODEL, MONO, MU, Mark, NS, P, Px, S, ST, STATUS, TBD, TU, Tick, type Theme,
  TypeOn, URL, carry, cells, count, fmt, gb, has, mono, on, rise, setTheme, show, useFonts, useV, x1, x2,
} from './kit';

// Nemotron-3.5-Bolt-E4B on a 3060, in the Maxwell / Inkling / Qwen family poster style.
//   01 the result · 02 the drafter · 03 the price (prefill) · 04 four users · 05 checks and limits · 06 run it · dh card.
// Every number comes from data.json (tools/prep.py checks each against runs/). Nulls print as a dash.

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
export type SceneP = {t: number};
const ctxK = (n: number) => `${Math.round(n / 1024)}K`;

// ---------- chrome ----------
export const M_ = 48;
const Body: React.FC<{children: React.ReactNode}> = ({children}) => {
  const v = useV();
  const top = 128, bottom = v ? 1760 : 976;
  return (
    <div style={{position: 'absolute', left: M_, right: M_, top, height: bottom - top, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      <div>{children}</div>
    </div>
  );
};
const CHAPTERS: [string, string][] = [['hook', 'THE RESULT'], ['drafter', 'THE DRAFTER'], ['price', 'THE PRICE'], ['multi', 'FOUR USERS'], ['limits', 'LIMITS'], ['run', 'RUN IT']];
const Chrome: React.FC<{t: number; si: number; t0: number}> = ({t, si, t0}) => {
  const v = useV();
  return (
    <>
      <div style={{position: 'absolute', left: M_, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
        <Glyph rows={CHIP} cell={6} color={P.cobalt} />
        <Lab><TypeOn text={`PLATE 0${si + 1} · ${CHAPTERS[si][1]}${v ? '' : ' · ' + STATUS}`} t={t} t0={t0} /></Lab>
      </div>
      <div style={{position: 'absolute', right: M_, top: 38, display: 'flex', gap: 8}}>
        {CHAPTERS.map((_, i) => <div key={i} style={{width: 20, height: 20, boxSizing: 'border-box', background: i <= si ? P.cobalt : 'transparent', border: i <= si ? 'none' : `2px solid ${P.rule}`}} />)}
      </div>
      <div style={{position: 'absolute', left: M_, right: M_, top: 96, height: 2, background: P.rule}} />
      <div style={{position: 'absolute', left: M_, right: M_, top: v ? 1784 : 1000, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
        {v ? <><Lab>{HW1}</Lab><Lab style={{marginTop: 8}}>{HW2}</Lab></> : <Lab>{`${HW1} · ${HW2}`}</Lab>}
      </div>
    </>
  );
};

// ---------- shared figures ----------
/** A horizontal bar on a shared scale, growing from 0 (k = 0..1). */
export const HBar: React.FC<{value: number | null; max: number; k: number; h: number; color: string}> = ({value, max, k, h, color}) => (
  <div style={{position: 'relative', height: h, width: '100%'}}>
    <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(has(value) ? (value as number) / max : 0) * k * 100}%`, background: color}} />
  </div>
);
/** "a → b" at one size, the first value muted. */
const Pair: React.FC<{a: string; b: React.ReactNode; size: number; t?: number; t0?: number; gap?: number}> = ({a, b, size, t = 99, t0 = 0, gap = 24}) => (
  <div style={{display: 'flex', alignItems: 'flex-start', gap}}>
    <Px size={size} color={P.muted}>{a}</Px><Arr size={size} t={t} t0={t0} /><Px size={size}>{b}</Px>
  </div>
);

// ---------- 01 · the result ----------
const Hook: React.FC<SceneP> = ({t}) => {
  const h = tl.hook;
  const v = useV();
  const big = S.x240;
  const sec = v ? S.l : S.m;
  return (
    <Body>
      <div style={rise(t, h.head)}>
        <Lab color={P.cobaltText}>{v ? `NVIDIA · Q4_K_M ${fmt(D.weights.gb, 2)} GB · ALL IN VRAM` : `NVIDIA · GEMMA-4-E4B BASE · Q4_K_M ${fmt(D.weights.gb, 2)} GB · ALL IN VRAM · 64K CTX`}</Lab>
        <Hop size={S.l} style={{marginTop: 24}}>{v ? `${MODEL}\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Hop>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 48 : 40, paddingTop: 24, ...show(t, h.nums)}}>
        <Lab>{v ? 'DECODE TOK/S · THINKING ON\nCARD → + DFLASH DRAFTER' : "DECODE · TOK/S · THINKING ON · CARD'S COMMAND → + DFLASH DRAFTER"}</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 40 : 56, marginTop: 32, flexWrap: v ? 'wrap' : 'nowrap', rowGap: 32}}>
          <Px size={big} color={P.muted}>{fmt(ST.decode_think, 1)}</Px>
          <Arr size={big} t={t} t0={h.nums + 0.15} />
          {v && <div style={{flexBasis: '100%', height: 0}} />}
          <Px size={big} style={show(t, h.nums + 0.35)}>{count(TU.decode_think, t, h.nums + 0.35, 1, ST.decode_think ?? 0)}</Px>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: 'flex-start', gap: v ? 40 : 96, marginTop: v ? 48 : 16}}>
        <Px size={big} color={P.vermilion} style={show(t, h.x)}>{x1(DER.speedup_think)}</Px>
        <div style={{display: 'flex', flexDirection: 'column', gap: v ? 40 : 24}}>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.sec)}}>
            <Lab>{`THINKING OFF · ${x1(DER.speedup_off)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.decode_off, 1)} b={fmt(TU.decode_off, 1)} size={sec} t={t} t0={h.sec + 0.1} /></div>
          </div>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.pp)}}>
            <Lab>{`AT 60K CONTEXT · ${x1(DER.speedup_60k)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.decode_60k, 1)} b={fmt(TU.decode_60k, 1)} size={sec} t={t} t0={h.pp + 0.1} /></div>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · the drafter ----------
/** grouped bars: stock, nospec (tuned, no drafter), default (DFlash), on one scale. */
export const DraftBars: React.FC<{t: number; t0: number; v: boolean; num: number; barH: number; gap?: number}> = ({t, t0, v, num, barH, gap = 40}) => {
  const groups: [string, [string, number, string][]][] = [
    ['EMPTY CONTEXT · THINKING ON', [['card', ST.decode_think, P.muted], ['no drafter', NS.decode_think, P.muted], ['DFlash', TU.decode_think, P.cobalt]]],
    ['AT 60K · THINKING OFF', [['card', ST.decode_60k, P.muted], ['no drafter', NS.decode_60k, P.muted], ['DFlash', TU.decode_60k, P.cobalt]]],
  ];
  const max = Math.max(TU.decode_think ?? 0, TU.decode_60k ?? 0, D.ceiling.decode_plain);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap}}>
      {groups.map(([g, rows], gi) => (
        <div key={g} style={{borderTop: `4px solid ${P.ink}`, paddingTop: 16, ...show(t, t0 + gi * 0.5)}}>
          <Lab color={P.ink}>{g}</Lab>
          {rows.map(([name, val, col], i) => {
            const ti = t0 + gi * 0.5 + i * 0.15;
            const win = col !== P.muted;
            return (
              <div key={name} style={{display: 'grid', gridTemplateColumns: `${v ? 232 : 264}px 1fr ${v ? 200 : 220}px`, columnGap: 32, alignItems: 'center', marginTop: v ? 12 : 8}}>
                <div style={mono(32, win ? P.cobaltText : P.muted, 600)}>{name}</div>
                <HBar value={val} max={max} k={carry(t, ti + 0.1, 0.6)} h={barH} color={col} />
                <Px size={num} color={win ? P.ink : P.muted} style={{textAlign: 'right'}}>{count(val, t, ti + 0.1, 1, 0, 0.6)}</Px>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
const Drafter: React.FC<SceneP> = ({t}) => {
  const k = tl.drafter;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, k.in)}>{v ? "One lever:\nthe card's DFlash\ndrafter" : "One lever: the card's DFlash drafter"}</Hop>
      <Lab style={{marginTop: 20, ...show(t, k.in + 0.2)}}>{v ? `DECODE TOK/S · PLAIN IS ${Math.round(DER.plain_pct_of_ceiling)}%\nOF ITS ${D.ceiling.decode_plain} TOK/S CEILING` : `DECODE TOK/S · PLAIN DECODE IS ALREADY ${Math.round(DER.plain_pct_of_ceiling)}% OF ITS ${D.ceiling.decode_plain} TOK/S CEILING`}</Lab>
      <div style={{marginTop: 32}}><DraftBars t={t} t0={k.rows} v={v} num={S.m} barH={v ? 40 : 24} gap={v ? 48 : 20} /></div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 48 : 32, ...show(t, k.gain)}}>
        <Px size={S.xl} color={P.vermilion}>{has(DER.tokens_per_step_think) ? DER.tokens_per_step_think.toFixed(1) : TBD}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>{`TOKENS PER STEP · ${has(TU.accept_think) ? Math.round(TU.accept_think * 100) : TBD}% OF ITS`}</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>7-TOKEN DRAFTS ACCEPTED</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 03 · the price: prefill ----------
export const PP_ROWS = (): [string, number, number, number][] => [
  ['8K', ST.prefill_8k, TU.prefill_8k, NS.prefill_8k],
  ['32K', ST.prefill_32k, TU.prefill_32k, NS.prefill_32k],
  ['60K', ST.prefill_60k, TU.prefill_60k, NS.prefill_60k],
];
const Price: React.FC<SceneP> = ({t}) => {
  const p = tl.price;
  const v = useV();
  const num = v ? S.m : S.l;
  const cols = v ? '120px 1fr 1fr 1fr' : '240px 1fr 1fr 1fr';
  const head = v ? ['PROMPT', 'CARD', 'DFLASH', 'NOSPEC'] : ['PROMPT', 'CARD', 'DFLASH', 'NOSPEC'];
  return (
    <Body>
      <Hop size={S.l} style={rise(t, p.in)}>{v ? 'The price:\nprefill' : 'The price: prefill'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, p.in + 0.2)}}>{v ? 'PREFILL TOK/S · THE DRAFTER\nREADS THE WHOLE PROMPT TOO' : 'PREFILL TOK/S · THE DRAFTER READS THE WHOLE PROMPT TOO'}</Lab>
      <div style={{marginTop: 32, ...show(t, p.rows)}}>
        <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32}}>
          {head.map((h, i) => <Lab key={h} color={i === 2 ? P.cobaltText : P.muted} style={{textAlign: i ? 'right' : 'left'}}>{h}</Lab>)}
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {PP_ROWS().map(([ctx, a, b, c], i) => {
            const ti = p.rows + 0.2 + i * 0.3;
            return (
              <div key={ctx} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', padding: v ? '20px 0' : '16px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
                <Lab color={P.ink}>{ctx}</Lab>
                <Px size={num} color={P.muted} style={{textAlign: 'right'}}>{fmt(a, 0)}</Px>
                <Px size={num} style={{textAlign: 'right'}}>{count(b, t, ti, 0, 0, 0.5)}</Px>
                <Px size={num} color={P.cobaltText} style={{textAlign: 'right'}}>{fmt(c, 0)}</Px>
              </div>
            );
          })}
          <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', padding: v ? '20px 0' : '16px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, p.rows + 1.1)}}>
            <Lab color={P.ink}>{v ? 'TTFT\n61K' : 'TTFT 61K'}</Lab>
            <Px size={num} color={P.muted} style={{textAlign: 'right'}}>{`${fmt(ST.ttft_61k, 1)} S`}</Px>
            <Px size={num} style={{textAlign: 'right'}}>{`${fmt(TU.ttft_61k, 1)} S`}</Px>
            <Px size={num} color={P.cobaltText} style={{textAlign: 'right'}}>{`${fmt(NS.ttft_61k, 1)} S`}</Px>
          </div>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 48 : 32, ...show(t, p.ratio)}}>
        <Px size={S.xl} color={P.vermilion}>{x2(DER.prefill_ratio_8k)}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>PREFILL AT 8K WITH THE DRAFTER.</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>{v ? 'LONG PROMPTS: NB_PROFILE=NOSPEC' : 'LONG PROMPTS, SHORT ANSWERS: NB_PROFILE=NOSPEC'}</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 04 · four users ----------
export const MULTI = (): [string, string, number | null, string][] => [
  ['4 × 32K + DFLASH', 'NB_PROFILE=multi', MU.c4, `4 × 30K NEEDLES AT ONCE: ${MU.soak_all_clean ? '3/3 EACH' : TBD}`],
  ['4 × 64K, NO DRAFTER', 'NB_SPEC=none', MU.c4_64k_nospec, '4 × 60K NEEDLES AT ONCE: 3/3 EACH'],
];
const Multi: React.FC<SceneP> = ({t}) => {
  const m = tl.multi;
  const v = useV();
  const max = Math.max(MU.c4 ?? 0, MU.c4_64k_nospec ?? 0);
  return (
    <Body>
      <Hop size={S.l} style={rise(t, m.in)}>{v ? 'Four users,\none card' : 'Four users, one card'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, m.in + 0.2)}}>{v ? 'AGGREGATE DECODE TOK/S\n4 REQUESTS AT ONCE' : 'AGGREGATE DECODE TOK/S · 4 SIMULTANEOUS REQUESTS'}</Lab>
      <div style={{marginTop: 32, borderTop: `4px solid ${P.ink}`}}>
        {MULTI().map(([name, f, val, sub], i) => {
          const ti = m.rows + i * 0.4;
          const win = i === 0;
          return (
            <div key={name} style={{padding: v ? '28px 0' : '20px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32}}>
                <div>
                  <Lab color={win ? P.ink : P.muted}>{name}</Lab>
                  <div style={{...mono(32, P.cobaltText), marginTop: 12}}>{f}</div>
                </div>
                <Px size={S.xl} color={win ? P.ink : P.muted}>{count(val, t, ti + 0.1, 1, 0, 0.6)}</Px>
              </div>
              <div style={{marginTop: 16}}><HBar value={val} max={max} k={carry(t, ti + 0.1, 0.6)} h={v ? 48 : 32} color={win ? P.cobalt : P.muted} /></div>
              <Lab style={{marginTop: 12}}>{sub}</Lab>
            </div>
          );
        })}
      </div>
      <div style={{marginTop: v ? 48 : 32, borderTop: `4px solid ${P.vermilion}`, paddingTop: 16, ...show(t, m.total)}}>
        <Lab color={P.ink}>{v ? '4 × 64K + DFLASH:\nCUDA OUT OF MEMORY' : '4 × 64K + DFLASH: CUDA OUT OF MEMORY UNDER FOUR LONG PROMPTS'}</Lab>
      </div>
    </Body>
  );
};

// ---------- 05 · checks and limits ----------
export const LIMITS = (): [string, string, string][] => [
  ['NEEDLES', `${TU.needles_61k?.[1] ?? TBD} AT 61K`, 'EVERY PROFILE, TEMPERATURE 0'],
  ['KLD', 'NOT MEASURED', 'NO BF16 OR Q8_0 REFERENCE ON DISK'],
  ['DRAFTER ACCEPTANCE', 'CODE PROMPTS', 'CHAT AND PROSE MAY ACCEPT LESS'],
  ['-BS', 'EXPERIMENTAL', 'UPSTREAM; GREEDY OUTPUT SAME'],
];
const Limits: React.FC<SceneP> = ({t}) => {
  const l = tl.limits;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, l.in)}>Checks and limits</Hop>
      <div style={{display: 'grid', gridTemplateColumns: v ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 64, rowGap: 40, marginTop: 40}}>
        {LIMITS().map(([lab, big, sub], i) => (
          <div key={lab} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, l.rows + i * 0.3)}}>
            <Lab color={P.ink}>{lab}</Lab>
            <Px size={v ? S.m : S.l} style={{marginTop: 16}}>{big}</Px>
            <Lab style={{marginTop: 16}}>{sub}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const CMD: [string, string][] = [
  ['./serve.sh', 'DFlash, 64k'],
  ['NB_PROFILE=nospec ./serve.sh', 'long prompts'],
  ['NB_PROFILE=multi ./serve.sh', '4 x 32k'],
];
const Run: React.FC<SceneP> = ({t}) => {
  const r = tl.run;
  const v = useV();
  const k = carry(t, r.cmd, 0.5);
  const sz = 32;
  const box = (
    <div style={{background: P.sheet, outline: `2px solid ${P.ink}`, padding: v ? '20px 24px' : '24px 32px', clipPath: k >= 1 ? 'none' : `inset(-4px ${(1 - k) * 100}% -4px -4px)`}}>
      {CMD.map(([c, note], i) => (
        <div key={i} style={{display: 'flex', flexDirection: v ? 'column' : 'row', marginBottom: i < CMD.length - 1 ? (v ? 16 : 8) : 0}}>
          <div style={{...mono(v ? sz : 48), width: v ? undefined : 960}}><TypeOn text={c} t={t} t0={r.cmd + 0.2 + i * 0.15} rate={0.008} /></div>
          <div style={{...mono(v ? sz : 48, P.muted), ...show(t, r.cmd + 0.5 + i * 0.15)}}>{`# ${note}`}</div>
        </div>
      ))}
    </div>
  );
  return (
    <Body>
      <Px size={S.l} color={P.cobaltText} style={{whiteSpace: 'pre', lineHeight: '88px', ...show(t, r.cmd + 0.6)}}>{v ? 'github.com/\ndavidghatley/\n3060-recipes' : URL}</Px>
      <div style={{marginTop: 32}}>{box}</div>
      <div style={{marginTop: 40, borderTop: `2px solid ${P.ink}`}}>
        {CREDITS.map(([key, val], i) => (
          <div key={key} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '640px 1fr', rowGap: 8, padding: v ? '20px 0' : '12px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, r.credits + i * 0.15)}}>
            <Lab>{key}</Lab>
            <Lab color={P.ink}>{val}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- the dh card (same close as the Flint, Inkling and Qwen videos; the name in Hopscotch) ----------
const DhCard: React.FC<{t: number}> = ({t}) => {
  const t0 = tl.end.dh;
  return (
    <AbsoluteFill style={{background: P.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <Mark cell={48} n={cells(t, t0, 21, 0.05)} />
      <div style={{textAlign: 'center', opacity: on(t, t0 + 1.2) ? 1 : 0}}>
        <div style={{fontFamily: HOP, fontWeight: 400, fontSynthesis: 'none', fontSize: 72, lineHeight: '88px', color: P.ink}}>David Hatley</div>
        <div style={{fontFamily: MONO, fontSize: 32, lineHeight: '40px', color: P.muted, marginTop: 12}}>design · AI/ML · generative tools</div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 48}}>
          <Glyph rows={CHIP} cell={6} />
          <span style={{fontFamily: MONO, fontSize: 32, lineHeight: '40px', color: P.ink}}>{URL}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- composition ----------
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['drafter', Drafter], ['price', Price], ['multi', Multi], ['limits', Limits], ['run', Run]];
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
export const NbLight: React.FC = () => <Launch theme="light" />;
export const NbDark: React.FC = () => <Launch theme="dark" />;
