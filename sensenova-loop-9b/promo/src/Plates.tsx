import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  Arr, CHIP, CREDITS, CTL, D, DER, GR, Glyph, HOP, HW1, HW2, Hop, LONG, LOOP, Lab, MODEL, MONO, Mark, P, Px, S, SIZE, ST, STATUS, TBD, TU,
  type Theme, TypeOn, UNC, URL, carry, cells, count, ctxK, fmt, has, mono, on, pct, rise, setTheme, show, useFonts, useV,
} from './kit';

// SenseNova-Loop-9B on a 3060, in the Maxwell / Inkling family poster style.
//   01 the result · 02 MTP follows acceptance · 03 the window · 04 uncensored · 05 limits · 06 run it · dh card.
// Every number comes from data.json (tools/prep.py checks each against runs/). Nulls print as a dash.

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
export type SceneP = {t: number};

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
const CHAPTERS: [string, string][] = [['hook', 'THE RESULT'], ['mtp', 'MTP SPREAD'], ['win', 'THE WINDOW'], ['unc', 'UNCENSORED'], ['limits', 'LIMITS'], ['run', 'RUN IT']];
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
export const HBar: React.FC<{value: number | null; max: number; k: number; h: number; color: string; outline?: boolean}> = ({value, max, k, h, color, outline}) => (
  <div style={{position: 'relative', height: h, width: '100%'}}>
    <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, boxSizing: 'border-box', width: `${(has(value) ? (value as number) / max : 0) * k * 100}%`, background: outline ? 'transparent' : color, border: outline ? `2px solid ${color}` : 'none'}} />
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
        <Lab color={P.cobaltText}>{v ? `${SIZE} LOOPED · ${ctxK(D.ctx)} CTX · MTP N=2` : `${SIZE} LOOPED HYBRID · ${LOOP} · ${ctxK(D.ctx)} CTX`}</Lab>
        <Hop size={S.l} style={{marginTop: 24}}>{v ? `${MODEL}\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Hop>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 48 : 40, paddingTop: 24, ...show(t, h.nums)}}>
        <Lab>{v ? 'DECODE TOK/S · PLAIN → MTP' : 'DECODE TOK/S · THINKING OFF · PLAIN → MTP N=2 · MEDIANS VS THREE CONTROLS'}</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 40 : 56, marginTop: 32, flexWrap: v ? 'wrap' : 'nowrap', rowGap: 32}}>
          <Px size={big} color={P.muted}>{fmt(CTL.off_mean, 1)}</Px>
          <Arr size={big} t={t} t0={h.nums + 0.15} />
          {v && <div style={{flexBasis: '100%', height: 0}} />}
          <Px size={big} style={show(t, h.nums + 0.35)}>{count(TU.decode_off, t, h.nums + 0.35, 1, CTL.off_mean ?? 0)}</Px>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: 'flex-start', gap: v ? 40 : 96, marginTop: v ? 48 : 16}}>
        <Px size={big} color={P.vermilion} style={show(t, h.x)}>{pct(DER.gain_off_pct)}</Px>
        <div style={{display: 'flex', flexDirection: 'column', gap: v ? 40 : 24}}>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.sec)}}>
            <Lab>{`THINKING ON · ${pct(DER.gain_on_pct)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(CTL.on_mean, 1)} b={fmt(TU.decode_on, 1)} size={sec} t={t} t0={h.sec + 0.1} /></div>
          </div>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.pp)}}>
            <Lab>{`PREFILL 8K PROMPT · ${pct(-DER.prefill_cost_pct)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.prefill_8k, 0)} b={fmt(TU.prefill_8k, 0)} size={sec} t={t} t0={h.pp + 0.1} /></div>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · MTP follows acceptance ----------
export const SpreadChart: React.FC<{t: number; t0: number; v: boolean; h: number; num: number}> = ({t, t0, v, h, num}) => {
  const rows = GR.rows as {i: number; plain: number; mtp: number; accept: number; same: boolean}[];
  const max = 40;
  const plain = GR.plain_mean as number;
  const labW = v ? 0 : 200;
  const y = (val: number) => h - (val / max) * h;
  return (
    <div>
      <div style={{display: 'flex'}}>
        {!v && <div style={{width: labW, position: 'relative', height: h}}><Lab style={{position: 'absolute', top: y(plain) - 40}}>PLAIN</Lab></div>}
        <div style={{flex: 1, position: 'relative', height: h, borderBottom: `4px solid ${P.ink}`}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', gap: v ? 16 : 32, alignItems: 'flex-end'}}>
            {rows.map((r, i) => {
              const ti = t0 + i * 0.08;
              const k = carry(t, ti, 0.5);
              const slow = r.mtp < r.plain;
              const col = slow ? P.vermilion : P.cobalt;
              return (
                <div key={r.i} style={{flex: 1, position: 'relative', height: '100%'}}>
                  <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: (r.mtp / max) * h * k, background: col}} />
                  <Px size={num} color={slow ? P.ink : P.muted} style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', top: Math.min(y(r.mtp), y(plain)) - num - 12, ...show(t, ti + 0.4)}}>{fmt(r.mtp, 1)}</Px>
                </div>
              );
            })}
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: y(plain) - 2, height: 0, borderTop: `4px dashed ${P.ink}`, ...show(t, t0 - 0.1)}} />
        </div>
      </div>
      <div style={{display: 'flex', marginTop: 16}}>
        {!v && <div style={{width: labW}}><Lab>ACCEPT</Lab></div>}
        <div style={{flex: 1, display: 'flex', gap: v ? 16 : 32}}>
          {rows.map((r, i) => <Px key={r.i} size={S.label} color={r.mtp < r.plain ? P.ink : P.muted} style={{flex: 1, textAlign: 'center', ...show(t, t0 + i * 0.08 + 0.4)}}>{`${Math.round(r.accept * 100)}%`}</Px>)}
        </div>
      </div>
      <div style={{display: 'flex', marginTop: 16, alignItems: 'center'}}>
        {!v && <div style={{width: labW}}><Lab>SAME TEXT</Lab></div>}
        <div style={{flex: 1, display: 'flex', gap: v ? 16 : 32}}>
          {rows.map((r, i) => (
            <div key={r.i} style={{flex: 1, display: 'flex', justifyContent: 'center', ...show(t, t0 + 0.8 + i * 0.05)}}>
              <div style={{width: 32, height: 32, boxSizing: 'border-box', background: r.same ? P.cobalt : 'transparent', border: `4px solid ${r.same ? P.cobalt : P.rule}`}} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
const Mtp: React.FC<SceneP> = ({t}) => {
  const c = tl.mtp;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, c.in)}>{v ? 'MTP speed follows\nacceptance' : 'MTP speed follows acceptance'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, c.in + 0.2)}}>{v ? `GREEDY SET · TOK/S · PLAIN ${fmt(GR.plain_mean, 1)} DASHED` : `GREEDY SET · ${GR.n} PROMPTS · MTP TOK/S PER PROMPT · PLAIN DECODE ${fmt(GR.plain_mean, 1)} DASHED`}</Lab>
      <div style={{marginTop: v ? 96 : 72}}><SpreadChart t={t} t0={c.rows} v={v} h={v ? 640 : 380} num={S.label} /></div>
      {v && <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 24, ...show(t, c.rows + 0.8)}}><Lab>ACCEPTANCE ↑ · SAME TEXT AS PLAIN ↑</Lab></div>}
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 56 : 40, ...show(t, c.gain)}}>
        <Px size={S.xl}>{`${fmt(GR.prose_mtp, 1)}`}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          {(v ? [`PROSE, ${Math.round(GR.prose_accept_pct)}% ACCEPTED:`, `SLOWER THAN PLAIN ${fmt(GR.prose_plain, 1)}`, `ONE THINKING SAMPLE AT ${fmt(TU.range_on?.[0], 1)}`, `SAME TEXT AS PLAIN ${GR.identical_off}/${GR.n}`]
            : [`PROSE AT ${Math.round(GR.prose_accept_pct)}% ACCEPTANCE: SLOWER THAN PLAIN ${fmt(GR.prose_plain, 1)}`, `ONE THINKING SAMPLE AT ${fmt(TU.range_on?.[0], 1)} · SAME TEXT ${GR.identical_off}/${GR.n}`])
            .map((x, i) => <Lab key={i} color={P.ink} style={{marginTop: i ? 8 : 0}}>{x}</Lab>)}
        </div>
      </div>
    </Body>
  );
};

// ---------- 03 · the window ----------
export const WIN_ROWS = (): [string, string, number, boolean, string, string][] => [
  ['128K', 'q8_0 K/V · MTP n=2 · default', D.ctx, true, `${fmt(TU.decode_off, 1)} · ${fmt(TU.decode_120k, 1)} AT 120K`, `NEEDLES ${TU.needles_65k?.[1] ?? TBD} · ${TU.needles_124k?.[1] ?? TBD}`],
  ['256K', 'q4_0 K/V · no MTP · long', D.long_ctx, true, `${fmt(LONG.decode, 1)} · ${fmt(LONG.decode_242k, 1)} AT 242K`, `NEEDLES ${LONG.needles_130k?.[1] ?? TBD} AT 130K · ${LONG.needles_248k?.[1] ?? TBD} AT 248K`],
  ['384K · 512K', 'q4_0 K/V', 524288, false, 'DOES NOT FIT', 'BUFFER WILL NOT ALLOCATE'],
];
const Win: React.FC<SceneP> = ({t}) => {
  const w = tl.win;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, w.in)}>{v ? '256K fits,\nwithout MTP' : '256K fits, without MTP'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, w.in + 0.2)}}>{v ? 'WINDOW · DECODE TOK/S EMPTY · DEEP' : 'WINDOW ON THE CARD · DECODE TOK/S EMPTY · DEEP · NEEDLES AT ~50% / ~95%'}</Lab>
      <div style={{marginTop: 32, borderTop: `4px solid ${P.ink}`}}>
        {WIN_ROWS().map(([ctx, what, n, fits, dec, nd], i) => {
          const ti = w.rows + i * 0.35;
          return (
            <div key={ctx} style={{padding: v ? '28px 0' : '18px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: v ? 'flex-start' : 'flex-end', flexDirection: v ? 'column' : 'row', gap: v ? 12 : 32}}>
                <div style={{display: 'flex', alignItems: 'flex-end', gap: 32}}>
                  <Px size={S.l} color={fits ? P.ink : P.muted}>{ctx}</Px>
                  <div style={{...mono(32, fits ? P.cobaltText : P.muted), marginBottom: 6}}>{what}</div>
                </div>
                <div style={{textAlign: v ? 'left' : 'right'}}>
                  <Lab color={fits ? P.ink : P.muted}>{dec}</Lab>
                  <Lab style={{marginTop: 8}}>{nd}</Lab>
                </div>
              </div>
              <div style={{marginTop: 16}}><HBar value={n} max={524288} k={carry(t, ti + 0.1, 0.6)} h={v ? 40 : 32} color={fits ? P.cobalt : P.muted} outline={!fits} /></div>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 48 : 32, ...show(t, w.gain)}}>
        <Px size={S.xl} color={P.vermilion}>{`${fmt(LONG.ttft_248k, 0)} S`}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>{`TO THE FIRST TOKEN ON A ${Math.floor(LONG.prompt_248k / 1000)}K PROMPT`}</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>FOR READING, NOT CHATTING</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 04 · uncensored ----------
export const ProbeRow: React.FC<{label: string; sub: string; answered: number; softened: number; n: number; t: number; t0: number; cell: number; gap: number}> = ({label, sub, answered, softened, n, t, t0, cell, gap}) => (
  <div>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
      <div><Lab color={P.ink}>{label}</Lab><Lab style={{marginTop: 8}}>{sub}</Lab></div>
      <Px size={S.l}>{`${answered}/${n}`}</Px>
    </div>
    <div style={{display: 'flex', gap, marginTop: 16}}>
      {Array.from({length: n}, (_, i) => {
        const vis = cells(t, t0, n, 0.03) > i;
        const full = i < answered - softened, soft = i >= answered - softened && i < answered;
        return <div key={i} style={{width: cell, height: cell, boxSizing: 'border-box', opacity: vis ? 1 : 0, background: full ? P.cobalt : soft ? P.tint : 'transparent', border: `4px solid ${full || soft ? P.cobalt : P.rule}`}} />;
      })}
    </div>
  </div>
);
const Unc: React.FC<SceneP> = ({t}) => {
  const u = tl.unc;
  const v = useV();
  const cell = v ? 40 : 56, gap = v ? 8 : 12;
  const stats: [string, string, string][] = [
    ['CODEEVAL', `${(UNC.codeeval_default ?? []).join('/')} → ${(UNC.codeeval ?? []).join('/')}`, 'THINKING OFF · TEMP 0'],
    ['DECODE TOK/S', `${fmt(UNC.stock_mean, 1)} = ${fmt(UNC.tuned, 1)}`, 'STOCK = TUNED · NO MTP HEAD'],
    ['IMAGE INPUT', UNC.image?.every(Boolean) ? 'BOTH' : TBD, 'OFFICIAL F16 PROJECTOR'],
  ];
  return (
    <Body>
      <Hop size={S.l} style={rise(t, u.in)}>{v ? "satellitedown's\nabliterated Q6_K" : "Uncensored: satellitedown's abliterated Q6_K"}</Hop>
      <Lab style={{marginTop: 20, ...show(t, u.in + 0.2)}}>{v ? `${UNC.probe_n} BORDERLINE PROMPTS · READ BY HAND` : `REFUSAL PROBE · ${UNC.probe_n} BORDERLINE PROMPTS · TEMP 0 · EVERY ANSWER READ BY HAND`}</Lab>
      <div style={{marginTop: 32, borderTop: `4px solid ${P.ink}`, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: v ? 40 : 28}}>
        <div style={show(t, u.rows)}><ProbeRow label="DEFAULT Q5_K_M" sub="ANSWERED" answered={UNC.answered_default_by_hand} softened={0} n={UNC.probe_n} t={t} t0={u.rows} cell={cell} gap={gap} /></div>
        <div style={show(t, u.rows + 0.5)}><ProbeRow label="ABLITERATED Q6_K" sub={`ANSWERED · ${UNC.softened} SOFTENED`} answered={UNC.answered_by_hand} softened={UNC.softened} n={UNC.probe_n} t={t} t0={u.rows + 0.5} cell={cell} gap={gap} /></div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr 1fr', columnGap: 48, rowGap: 32, marginTop: v ? 56 : 40}}>
        {stats.map(([k, big, sub], i) => (
          <div key={k} style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, u.stats + i * 0.2)}}>
            <Lab>{k}</Lab>
            <Px size={S.m} style={{marginTop: 16}}>{big}</Px>
            <Lab style={{marginTop: 12}}>{sub}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 05 · limits ----------
export const LIMITS = (): [string, string, string][] => [
  ['GREEDY VS PLAIN', `${GR.identical_off}/${GR.n} SAME`, `THINKING ON ${D.greedy.identical_on}/${GR.n} · STILL COHERENT`],
  ['KLD', 'NOT MEASURED', 'NO Q8_0 OR BF16 FILE ON DISK'],
  ['ABOVE 256K', 'NO FIT', 'MTP ABOVE 128K DOES NOT FIT EITHER'],
  ['STOCK LLAMA.CPP', 'NO LOAD', `NEEDS PR #${D.engine.pr}`],
];
const Limits: React.FC<SceneP> = ({t}) => {
  const l = tl.limits;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, l.in)}>What it does not do</Hop>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr', columnGap: 64, rowGap: 40, marginTop: 40}}>
        {LIMITS().map(([lab, big, sub], i) => (
          <div key={lab} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, l.rows + i * 0.3)}}>
            <Lab color={P.ink}>{lab}</Lab>
            <Px size={S.l} style={{marginTop: 16}}>{big}</Px>
            <Lab style={{marginTop: 16}}>{sub}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const CMD: [string, string][] = [
  ['./serve.sh', '128k, MTP n=2'],
  ['SNL_PROFILE=long ./serve.sh', '256k, q4_0 K/V'],
  ['VARIANT=uncensored ./serve.sh', 'abliterated Q6_K'],
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
          <div key={key} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '560px 1fr', rowGap: 8, padding: v ? '20px 0' : '12px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, r.credits + i * 0.15)}}>
            <Lab>{key}</Lab>
            <Lab color={P.ink}>{val}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- the dh card (same close as the Flint, Inkling, Qwen and Maxwell videos; the name in Hopscotch) ----------
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
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['mtp', Mtp], ['win', Win], ['unc', Unc], ['limits', Limits], ['run', Run]];
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
export const SnLight: React.FC = () => <Launch theme="light" />;
export const SnDark: React.FC = () => <Launch theme="dark" />;
