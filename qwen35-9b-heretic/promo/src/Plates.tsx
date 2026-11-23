import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  Arr, BY, CHIP, CREDITS, D, DER, DF, FA, GR, Glyph, HOP, HW1, HW2, Hop, KL, LA, LG, Lab, MODEL, MONO, Mark, NS, P, Px, RF, S, ST, STATUS, TBD,
  type Theme, TypeOn, URL, carry, cells, count, fmt, has, mono, nk, on, pct, rise, setTheme, show, useFonts, useV, xfmt,
} from './kit';

// Qwen3.5-9B Heretic on a 3060, in the SenseNova / Maxwell / Inkling family poster style.
//   01 the result · 02 the BF16 head · 03 long answers · 04 the window · 05 uncensored and the price · 06 run it · dh card.
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
const CHAPTERS: [string, string][] = [['hook', 'THE RESULT'], ['head', 'THE BF16 HEAD'], ['ans', 'LONG ANSWERS'], ['win', 'THE WINDOW'], ['unc', 'UNCENSORED'], ['run', 'RUN IT']];
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
/** Big number on the left, one or more label lines beside (16:9) or below (9:16) it. */
const Callout: React.FC<{big: string; color?: string; lines: string[]; style?: React.CSSProperties}> = ({big, color = P.ink, lines, style}) => {
  const v = useV();
  return (
    <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, ...style}}>
      <Px size={S.xl} color={color}>{big}</Px>
      <div style={{marginBottom: v ? 0 : 12}}>{lines.map((x, i) => <Lab key={i} color={P.ink} style={{marginTop: i ? 8 : 0}}>{x}</Lab>)}</div>
    </div>
  );
};

// ---------- 01 · the result ----------
const Hook: React.FC<SceneP> = ({t}) => {
  const h = tl.hook;
  const v = useV();
  const big = S.x240;
  const sec = v ? S.l : S.m;
  return (
    <Body>
      <div style={rise(t, h.head)}>
        <Lab color={P.cobaltText}>{v ? 'UNCENSORED 9B · OWN MTP HEAD · IN VRAM' : 'UNCENSORED 9B MERGE · ITS OWN MTP HEAD · ALL IN VRAM · 64K F16'}</Lab>
        <Hop size={S.l} style={{marginTop: 24}}>{v ? `${MODEL}\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Hop>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 48 : 40, paddingTop: 24, ...show(t, h.nums)}}>
        <Lab>{v ? 'DECODE TOK/S · STOCK → MTP N=2' : `DECODE TOK/S · THINKING OFF · STOCK → MTP N=2 · ACCEPT ${fmt(DF.accept_off, 2)}`}</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 40 : 56, marginTop: 32, flexWrap: v ? 'wrap' : 'nowrap', rowGap: 32}}>
          <Px size={big} color={P.muted}>{fmt(ST.decode_off, 1)}</Px>
          <Arr size={big} t={t} t0={h.nums + 0.15} />
          {v && <div style={{flexBasis: '100%', height: 0}} />}
          <Px size={big} style={show(t, h.nums + 0.35)}>{count(DF.decode_off, t, h.nums + 0.35, 1, ST.decode_off ?? 0)}</Px>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: 'flex-start', gap: v ? 40 : 96, marginTop: v ? 48 : 16}}>
        <Px size={big} color={P.vermilion} style={show(t, h.x)}>{xfmt(DER.x_default)}</Px>
        <div style={{display: 'flex', flexDirection: 'column', gap: v ? 40 : 24}}>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.sec)}}>
            <Lab>{`THINKING ON · ${xfmt(DER.x_on)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.decode_on, 1)} b={fmt(DF.decode_on, 1)} size={sec} t={t} t0={h.sec + 0.1} /></div>
          </div>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.pp)}}>
            <Lab>{`DEEP · 63K → 60K CONTEXT · ${xfmt(DER.x_deep)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.decode_deep, 1)} b={fmt(DF.decode_deep, 1)} size={sec} t={t} t0={h.pp + 0.1} /></div>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · the BF16 head ----------
const MAXGB = 8;
/** One stacked bytes-per-token bar: blocks, head, state, on a shared GB scale. */
const BytesBar: React.FC<{label: string; head: number; total: number; t: number; t0: number; h: number}> = ({label, head, total, t, t0, h}) => {
  const k = carry(t, t0, 0.6);
  const segs: [number, string, boolean][] = [[BY.blocks, P.tint, true], [head, P.cobalt, false], [BY.state, P.muted, false]];
  const v = useV();
  return (
    <div style={show(t, t0)}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
        <Lab color={P.ink}>{label}</Lab>
        <Px size={v ? S.m : S.m} style={show(t, t0 + 0.5)}>{`${fmt(total, 2)} GB`}</Px>
      </div>
      <div style={{position: 'relative', height: h, marginTop: 16, clipPath: `inset(-4px ${(1 - k) * 100}% -4px -4px)`}}>
        {(() => {
          let x = 0;
          return segs.map(([gb, col, outline], i) => {
            const left = (x / MAXGB) * 100;
            x += gb;
            return <div key={i} style={{position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${(gb / MAXGB) * 100}%`, boxSizing: 'border-box', background: col, border: outline ? `2px solid ${P.cobalt}` : 'none'}} />;
          });
        })()}
      </div>
      <div style={{position: 'relative', height: 32, marginTop: 12, ...show(t, t0 + 0.5)}}>
        <Lab style={{position: 'absolute', left: 0}}>{`BLOCKS ${fmt(BY.blocks, 2)}`}</Lab>
        <Lab color={P.cobaltText} style={{position: 'absolute', left: `${(BY.blocks / MAXGB) * 100}%`, paddingLeft: 12}}>{`HEAD ${fmt(head, 2)}`}</Lab>
      </div>
    </div>
  );
};
const Head02: React.FC<SceneP> = ({t}) => {
  const c = tl.head;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, c.in)}>{v ? `The BF16 head is\n${Math.round(DER.head_pct)}% of every token` : `The BF16 head is ${Math.round(DER.head_pct)}% of every token`}</Hop>
      <Lab style={{marginTop: 20, ...show(t, c.in + 0.2)}}>{v ? 'GB READ PER TOKEN · PLAIN DECODE' : 'GB READ PER DECODED TOKEN · BLOCKS Q6_K · OUTPUT HEAD · RECURRENT STATE'}</Lab>
      <div style={{marginTop: v ? 64 : 40, display: 'flex', flexDirection: 'column', gap: v ? 72 : 28}}>
        <BytesBar label="PUBLISHED FILE · BF16 HEAD" head={BY.head_bf16} total={BY.total} t={t} t0={c.bars} h={v ? 96 : 48} />
        <BytesBar label="LOCAL COPY · Q8_0 HEAD" head={BY.head_q8} total={BY.total_q8} t={t} t0={c.bars + 0.4} h={v ? 96 : 48} />
      </div>
      <div style={{marginTop: v ? 64 : 28, ...show(t, c.draft)}}>
        {(v ? ['EVERY MTP DRAFT READS THE HEAD AGAIN:', `${fmt(BY.draft, 2)} GB, ${Math.round(DER.draft_pct)}% OF A FULL STEP`] : [`EVERY MTP DRAFT READS THE HEAD AGAIN: ${fmt(BY.draft, 2)} GB, ${Math.round(DER.draft_pct)}% OF A FULL STEP`])
          .map((x, i) => <Lab key={i} color={P.ink} style={{marginTop: i ? 8 : 0}}>{x}</Lab>)}
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 64 : 28, paddingTop: v ? 32 : 24, ...show(t, c.gain)}}>
        <Callout big={fmt(FA.decode_off, 1)} color={P.vermilion} lines={v
          ? [`TOK/S · FAST PROFILE · ${xfmt(DER.x_fast)}`, `KLD ${fmt(KL.head_wiki, 4)} VS THE PUBLISHED FILE`, 'LOCAL DERIVED FILE · OPT-IN']
          : [`TOK/S WITH MTP · FAST PROFILE · ${xfmt(DER.x_fast)} STOCK`, `KLD ${fmt(KL.head_wiki, 4)} VS THE PUBLISHED FILE · LOCAL FILE, OPT-IN`]} />
      </div>
    </Body>
  );
};

// ---------- 03 · long answers ----------
const Ans: React.FC<SceneP> = ({t}) => {
  const a = tl.ans;
  const v = useV();
  const M = LA.mtp, N = LA.nospec;
  const rows: [string, string, string][] = [
    ['FINISHED', `${M.finished}/${M.n}`, `${N.finished}/${N.n}`],
    ['HIT THE CAP', `${M.capped}`, `${N.capped} · SAME PROMPT`],
    ['LOOPS', `${M.loops}`, `${N.loops}`],
    ['TOK/S', `${fmt(M.tps_min, 0)}–${fmt(M.tps_max, 0)}`, `${fmt(N.tps_min, 1)}–${fmt(N.tps_max, 1)}`],
  ];
  const cols = v ? '1fr 260px 320px' : '1fr 400px 520px';
  return (
    <Body>
      <Hop size={S.l} style={rise(t, a.in)}>{v ? 'MTP keeps long\nanswers intact' : 'MTP keeps long answers intact'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, a.in + 0.2)}}>{v ? 'SIX PROMPTS · THINKING ON · 10K CAP' : 'SIX PROMPTS · THINKING ON · 10K CAP · THE FAMILY LOOPED ON B12242'}</Lab>
      <div style={{marginTop: 40, display: 'grid', gridTemplateColumns: cols, columnGap: 32, ...show(t, a.rows)}}>
        <Lab>{' '}</Lab><Lab style={{textAlign: 'right'}}>MTP N=2</Lab><Lab style={{textAlign: 'right'}}>NO SPEC</Lab>
      </div>
      <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
        {rows.map(([k, m, n], i) => (
          <div key={k} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', padding: v ? '36px 0' : '14px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, a.rows + 0.2 + i * 0.25)}}>
            <Lab color={P.ink}>{k}</Lab>
            <Px size={S.m} style={{textAlign: 'right'}}>{m}</Px>
            <Px size={v ? S.label : S.m} color={P.muted} style={{textAlign: 'right'}}>{n}</Px>
          </div>
        ))}
      </div>
      <Callout style={{marginTop: v ? 96 : 36, ...show(t, a.gain)}} big={`${LA.tokens_24k / 1000}K`} color={P.vermilion} lines={v
        ? ['TOKENS IN ONE MTP ANSWER, COHERENT', `GREEDY: ${GR.identical_on}/${GR.n_on} SAME AS PLAIN (ON)`, `${GR.identical_off}/${GR.n_off} (OFF)`]
        : ['TOKENS IN ONE MTP ANSWER, COHERENT, NO REPEATS', `GREEDY OUTPUT SAME AS PLAIN: ${GR.identical_on}/${GR.n_on} THINKING ON, ${GR.identical_off}/${GR.n_off} OFF`]} />
    </Body>
  );
};

// ---------- 04 · the window ----------
const NATIVE = 262144;
export const WIN_ROWS = (): [string, string, number, boolean, string, string][] => [
  ['64K', 'f16 K/V · MTP · default', 65536, true, `${fmt(DF.decode_off, 1)} · ${fmt(DF.decode_deep, 1)} AT 60K`, `NEEDLES ${DF.needles_50?.[1] ?? TBD} · ${DF.needles_95?.[1] ?? TBD} AT ${nk(DF.needles_95)}`],
  ['128K', 'q8_0 · MTP · fast', 131072, true, `${fmt(FA.decode_off, 1)} · ${fmt(FA.decode_deep, 1)} AT 120K`, `NEEDLES ${FA.needles_50?.[1] ?? TBD} · ${FA.needles_95?.[1] ?? TBD} AT ${nk(FA.needles_95)}`],
  ['192K', 'q4_0 · no MTP · long', 196608, true, `${fmt(LG.decode_off, 1)} · ${fmt(LG.decode_deep, 1)} AT 180K`, `NEEDLES ${LG.needles_50?.[1] ?? TBD} · ${LG.needles_95?.[1] ?? TBD} AT ${nk(LG.needles_95)}`],
  ['262K', 'native window', NATIVE, false, 'DOES NOT FIT', 'NOT WITH THE BF16 HEAD'],
];
const Win: React.FC<SceneP> = ({t}) => {
  const w = tl.win;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, w.in)}>{v ? '64K with MTP,\n192K without' : '64K with MTP, 192K without'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, w.in + 0.2)}}>{v ? 'WINDOW · DECODE TOK/S EMPTY · DEEP' : 'WINDOW ON THE CARD · DECODE TOK/S EMPTY · DEEP · NEEDLES AT ~50% / ~95%'}</Lab>
      <div style={{marginTop: 28, borderTop: `4px solid ${P.ink}`}}>
        {WIN_ROWS().map(([ctx, what, n, fits, dec, nd], i) => {
          const ti = w.rows + i * 0.3;
          return (
            <div key={ctx} style={{padding: v ? '24px 0' : '12px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: v ? 'flex-start' : 'flex-end', flexDirection: v ? 'column' : 'row', gap: v ? 12 : 32}}>
                <div style={{display: 'flex', alignItems: 'flex-end', gap: 32}}>
                  <Px size={v ? S.l : S.m} color={fits ? P.ink : P.muted}>{ctx}</Px>
                  <div style={{...mono(32, fits ? P.cobaltText : P.muted), marginBottom: v ? 12 : 2}}>{what}</div>
                </div>
                <div style={{textAlign: v ? 'left' : 'right'}}>
                  <Lab color={fits ? P.ink : P.muted}>{dec}</Lab>
                  <Lab style={{marginTop: 8}}>{nd}</Lab>
                </div>
              </div>
              <div style={{marginTop: 12}}><HBar value={n} max={NATIVE} k={carry(t, ti + 0.1, 0.6)} h={v ? 32 : 20} color={fits ? P.cobalt : P.muted} outline={!fits} /></div>
            </div>
          );
        })}
      </div>
      <Callout style={{marginTop: v ? 48 : 28, ...show(t, w.gain)}} big={`${fmt(LG.ttft_95, 0)} S`} color={P.vermilion}
        lines={[`TO THE FIRST TOKEN ON A ${nk(LG.needles_95).replace('.0K', 'K')} PROMPT`, 'LONG IS FOR READING, NOT CHATTING']} />
    </Body>
  );
};

// ---------- 05 · uncensored, and the price ----------
const Unc: React.FC<SceneP> = ({t}) => {
  const u = tl.unc;
  const v = useV();
  const cell = v ? 40 : 64, gap = v ? 8 : 16;
  const vis = cells(t, u.rows + 0.3, RF.n, 0.03);
  const stats: [string, string, string, string?][] = [
    ['PREFILL 8K TOK/S', `${fmt(ST.prefill_8k, 0)} → ${fmt(DF.prefill_8k, 0)}`, `${pct(-DER.prefill_cost_pct)} WITH MTP`],
    ['CODEEVAL', `${(ST.codeeval ?? []).join('/')} = ${(DF.codeeval ?? []).join('/')}`, 'STOCK = DEFAULT · TEMP 0'],
    ['QUANT KLD VS BF16', 'NOT RUN', 'NO REFERENCE FILE ON DISK'],
    ['BASE MODEL PROBE', 'NOT RUN', 'NO BASE FILE ON DISK'],
  ];
  return (
    <Body>
      <Hop size={S.l} style={rise(t, u.in)}>{v ? 'Uncensored, and\nwhat it costs' : 'Uncensored, and what it costs'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, u.in + 0.2)}}>{v ? `${RF.n} PROMPTS · EVERY ANSWER READ` : `${RF.n} BORDERLINE PROMPTS · THINKING OFF · TEMP 0 · EVERY ANSWER READ`}</Lab>
      <div style={{marginTop: 32, borderTop: `4px solid ${P.ink}`, paddingTop: 24, ...show(t, u.rows)}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <div><Lab color={P.ink}>HERETIC MERGE · Q6_K</Lab><Lab style={{marginTop: 8}}>ANSWERED · 0 REFUSED</Lab></div>
          <Px size={S.l}>{`${RF.answered_by_hand}/${RF.n}`}</Px>
        </div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap, marginTop: 16}}>
          {Array.from({length: RF.n}, (_, i) => (
            <div key={i} style={{width: cell, height: cell, boxSizing: 'border-box', opacity: vis > i ? 1 : 0, background: i < RF.answered_by_hand ? P.cobalt : 'transparent', border: `4px solid ${i < RF.answered_by_hand ? P.cobalt : P.rule}`}} />
          ))}
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr', columnGap: 64, rowGap: v ? 28 : 28, marginTop: v ? 48 : 36}}>
        {stats.map(([k, big, sub], i) => (
          <div key={k} style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, u.stats + i * 0.2)}}>
            <Lab>{k}</Lab>
            <Px size={S.m} color={i === 0 ? P.ink : i > 1 ? P.muted : P.ink} style={{marginTop: 16}}>{big}</Px>
            <Lab style={{marginTop: 12}}>{sub}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const CMD: [string, string][] = [
  ['./serve.sh', '64k, MTP n=2'],
  ['tools/requant_head.sh', 'once, Q8_0 head'],
  ['QH_PROFILE=fast ./serve.sh', '128k, MTP n=2'],
  ['QH_PROFILE=long ./serve.sh', '192k, no MTP'],
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
          <div key={key} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '640px 1fr', columnGap: 32, rowGap: 8, padding: v ? '16px 0' : '12px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, r.credits + i * 0.15)}}>
            <Lab>{key}</Lab>
            <Lab color={P.ink}>{val}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- the dh card (same close as the Flint, Inkling, Qwen, Maxwell and SenseNova videos; the name in Hopscotch) ----------
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
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['head', Head02], ['ans', Ans], ['win', Win], ['unc', Unc], ['run', Run]];
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
export const QhLight: React.FC = () => <Launch theme="light" />;
export const QhDark: React.FC = () => <Launch theme="dark" />;
export {D, NS};
