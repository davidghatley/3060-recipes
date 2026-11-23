import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  Arr, CHIP, CREDITS, D, DER, Glyph, HOP, HW1, HW2, Hop, LV, Lab, MODEL, MONO, Mark, P, Px, S, SIZE, ST, STATUS, TBD, TU, Tick, type Theme,
  TypeOn, UNC, URL, pct1, carry, cells, count, fmt, has, mono, on, pct, rise, setTheme, show, useFonts, useV, x2,
} from './kit';

// Maxwell-V1-Flash on a 3060, in the Inkling / Qwen family poster style.
//   01 the result · 02 where the experts go · 03 KV at depth · 04 prefill · 05 limits · 06 run it · dh card.
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
const CHAPTERS: [string, string][] = [['hook', 'THE RESULT'], ['cache', 'EXPERT CACHE'], ['kv', 'KV AT DEPTH'], ['prefill', 'PREFILL'], ['limits', 'LIMITS'], ['run', 'RUN IT']];
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
        <Lab color={P.cobaltText}>{v ? `${SIZE} MOE · ${ctxK(D.ctx)} CTX` : `${SIZE} MOE · ATOMICCHAT ${D.weights.file} ${fmt(D.weights.gb, 1)} GB · ${ctxK(D.ctx)} CTX`}</Lab>
        <Hop size={S.l} style={{marginTop: 24}}>{v ? `${MODEL}\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Hop>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 48 : 40, paddingTop: 24, ...show(t, h.nums)}}>
        <Lab>{v ? 'DECODE TOK/S · STOCK → TUNED' : 'DECODE · TOK/S · STOCK LLAMA.CPP FLAGS → TUNED'}</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 40 : 56, marginTop: 32, flexWrap: v ? 'wrap' : 'nowrap', rowGap: 32}}>
          <Px size={big} color={P.muted}>{fmt(ST.decode, 1)}</Px>
          <Arr size={big} t={t} t0={h.nums + 0.15} />
          {v && <div style={{flexBasis: '100%', height: 0}} />}
          <Px size={big} style={show(t, h.nums + 0.35)}>{count(TU.decode, t, h.nums + 0.35, 1, ST.decode ?? 0)}</Px>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: 'flex-start', gap: v ? 40 : 96, marginTop: v ? 48 : 16}}>
        <Px size={big} color={P.vermilion} style={show(t, h.x)}>{x2(DER.speedup_decode)}</Px>
        <div style={{display: 'flex', flexDirection: 'column', gap: v ? 40 : 24}}>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.sec)}}>
            <Lab>{`DECODE AT 32K · ${x2(DER.speedup_decode_32k)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.decode_32k, 1)} b={fmt(TU.decode_32k, 1)} size={sec} t={t} t0={h.sec + 0.1} /></div>
          </div>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 16, ...show(t, h.pp)}}>
            <Lab>{`PREFILL 8K PROMPT · ${x2(DER.speedup_prefill_8k)}`}</Lab>
            <div style={{marginTop: 16}}><Pair a={fmt(ST.prefill_8k, 0)} b={fmt(TU.prefill_8k, 0)} size={sec} t={t} t0={h.pp + 0.1} /></div>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · where the experts go ----------
export const CacheRows: React.FC<{t: number; t0: number; v: boolean; num: number; barH: number; pad: number; flag?: number}> = ({t, t0, v, num, barH, pad, flag = 32}) => {
  const rows: [string, string, number, boolean][] = [
    ['layers pinned', `--n-cpu-moe 33  # ${LV.pinned_layers} MoE layers on the card`, LV.pinned, false],
    ['hot expert cache', `--cpu-moe --moe-cache-mib ${LV.cache_mib}`, LV.cache, true],
  ];
  const max = Math.max(LV.pinned ?? 0, LV.cache ?? 0);
  return (
    <div style={{borderTop: `4px solid ${P.ink}`}}>
      {rows.map(([name, f, val, win], i) => {
        const ti = t0 + i * 0.35;
        const k = carry(t, ti + 0.1, 0.6);
        return (
          <div key={name} style={{padding: `${pad}px 0`, borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
              <div>
                <Tick color={win ? P.ink : P.muted}>{name}</Tick>
                <div style={{...mono(flag, P.cobaltText), marginTop: 12}}>{v ? f.split('  #')[0] : f}</div>
              </div>
              <Px size={num} color={win ? P.ink : P.muted}>{count(val, t, ti + 0.1, 1, 0, 0.6)}</Px>
            </div>
            <div style={{marginTop: 16}}><HBar value={val} max={max} k={k} h={barH} color={win ? P.cobalt : P.muted} /></div>
          </div>
        );
      })}
    </div>
  );
};
const Cache: React.FC<SceneP> = ({t}) => {
  const c = tl.cache;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, c.in)}>{v ? 'Same VRAM:\nhot experts,\nnot whole layers' : 'Same VRAM: hot experts, not whole layers'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, c.in + 0.2)}}>{v ? 'DECODE TOK/S · Q8_0 KV · 64K' : 'DECODE TOK/S · EMPTY CONTEXT · Q8_0 KV · 64K · AGAINST FIVE CONTROLS'}</Lab>
      <div style={{marginTop: 32}}><CacheRows t={t} t0={c.rows} v={v} num={S.xl} barH={v ? 64 : 56} pad={v ? 32 : 20} /></div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 48 : 32, ...show(t, c.gain)}}>
        <Px size={S.xl} color={P.vermilion}>{pct(DER.cache_gain_pct)}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>EVERY ROUTED EXPERT IN RAM,</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>THE HOT ONES CACHED ON THE CARD</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 03 · KV at depth ----------
export const KvBars: React.FC<{t: number; t0: number; v: boolean; num: number; barH: number; gap?: number}> = ({t, t0, v, num, barH, gap = 40}) => {
  const groups: [string, [string, number, string][]][] = [
    ['EMPTY CONTEXT', [['q8_0', LV.q8_empty, P.muted], ['f16', LV.f16_empty, P.cobalt]]],
    ['AT 32K', [['q8_0', LV.q8_32k, P.muted], ['f16', LV.f16_32k, P.cobalt]]],
  ];
  const max = Math.max(LV.q8_empty ?? 0, LV.f16_empty ?? 0, LV.q8_32k ?? 0, LV.f16_32k ?? 0);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap}}>
      {groups.map(([g, rows], gi) => (
        <div key={g} style={{borderTop: `4px solid ${P.ink}`, paddingTop: 16, ...show(t, t0 + gi * 0.5)}}>
          <Lab color={P.ink}>{g}</Lab>
          {rows.map(([name, val, col], i) => {
            const ti = t0 + gi * 0.5 + i * 0.2;
            return (
              <div key={name} style={{display: 'grid', gridTemplateColumns: `${v ? 120 : 160}px 1fr ${num * 3}px`, columnGap: 32, alignItems: 'center', marginTop: 16}}>
                <div style={mono(32, col === P.muted ? P.muted : P.cobaltText, 600)}>{name}</div>
                <HBar value={val} max={max} k={carry(t, ti + 0.1, 0.6)} h={barH} color={col} />
                <Px size={num} color={col === P.muted ? P.muted : P.ink} style={{textAlign: 'right'}}>{count(val, t, ti + 0.1, 1, 0, 0.6)}</Px>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
const Kv: React.FC<SceneP> = ({t}) => {
  const k = tl.kv;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, k.in)}>{v ? 'Deep in the window,\nf16 KV wins' : 'Deep in the window, f16 KV wins'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, k.in + 0.2)}}>{v ? 'DECODE TOK/S · DENSE ATTENTION' : 'DECODE TOK/S · EVERY LAYER RUNS DENSE ATTENTION IN THE PORT'}</Lab>
      <div style={{marginTop: 32}}><KvBars t={t} t0={k.rows} v={v} num={S.l} barH={v ? 56 : 40} gap={v ? 48 : 24} /></div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 48 : 32, ...show(t, k.gain)}}>
        <Px size={S.xl} color={P.vermilion}>{has(DER.q8_slower_at_32k_pct) ? `−${Math.round(DER.q8_slower_at_32k_pct)}%` : TBD}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>Q8_0 AT 32K. F16 IS FASTER FROM</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>ABOUT 4K TOKENS, SO IT IS THE DEFAULT</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 04 · prefill ----------
export const PP_ROWS = (): [string, string, number, number, number][] => [
  ['--load-mode none', 'weights read into memory, not mmap', LV.lm_ctl, LV.lm, DER.loadmode_gain_pct],
  ['-ub 1024', `bigger batches · decode ${pct1(DER.ub1024_decode_pct)}`, LV.ub512_pp, LV.ub1024_pp, DER.ub1024_prefill_pct],
];
const Prefill: React.FC<SceneP> = ({t}) => {
  const p = tl.prefill;
  const v = useV();
  const rows = PP_ROWS();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, p.in)}>{v ? 'Two flags for\nprefill' : 'Two flags for prefill'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, p.in + 0.2)}}>{v ? 'PREFILL TOK/S · 8K PROMPT' : 'PREFILL TOK/S · 8K PROMPT · EACH AGAINST ITS OWN CONTROLS'}</Lab>
      <div style={{marginTop: 32, borderTop: `4px solid ${P.ink}`}}>
        {rows.map(([f, what, a, b, g], i) => {
          const ti = p.rows + i * 0.4;
          return (
            <div key={f} style={{padding: v ? '28px 0' : '20px 0', borderBottom: `2px solid ${P.faint}`, display: 'flex', flexDirection: v ? 'column' : 'row', justifyContent: 'space-between', alignItems: v ? 'flex-start' : 'center', gap: v ? 20 : 32, ...show(t, ti)}}>
              <div>
                <div style={mono(48, P.cobaltText, 600)}>{f}</div>
                <Tick color={P.muted} style={{marginTop: 12}}>{what.split(' · ')[0]}</Tick>
                {what.includes(' · ') && <Lab style={{marginTop: 12}}>{what.split(' · ')[1].toUpperCase()}</Lab>}
              </div>
              <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
                <Pair a={fmt(a, 0)} b={fmt(b, 0)} size={S.l} t={t} t0={ti + 0.15} />
                <Px size={S.l} color={P.cobaltText} style={show(t, ti + 0.4)}>{pct(g)}</Px>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 40, marginTop: v ? 48 : 32, ...show(t, p.total)}}>
        <Px size={S.xl} color={P.vermilion}>{x2(DER.speedup_prefill_8k)}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>{`STOCK ${fmt(ST.prefill_8k, 0)} → TUNED ${fmt(TU.prefill_8k, 0)} TOK/S`}</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>{`32K PROMPT: ${fmt(ST.prefill_32k, 0)} → ${fmt(TU.prefill_32k, 0)}`}</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 05 · limits ----------
export const LIMITS = (): [string, string, string, string | null][] => [
  ['NEEDLES', String(TU.needles_32k?.[1] ?? TBD), 'EXACT AT 32K · NOT CLEAN AT ~62K', null],
  ['UNCENSORED LORA', fmt(UNC.decode, 1), `TOK/S · BASE ${fmt(UNC.controls?.[0], 1)} / ${fmt(UNC.controls?.[1], 1)}`, pct(DER.lora_cost_pct)],
  ['MODEL CARD LINE', 'NO LOAD', `${D.card_line.flags.toUpperCase()} · ${fmt(D.card_line.mib)} MIB`, null],
  ['DRIFT VS BF16', 'NOT MEASURED', 'NO BF16 OR Q8_0 FILE FITS ON DISK', null],
];
const Limits: React.FC<SceneP> = ({t}) => {
  const l = tl.limits;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, l.in)}>{v ? 'What it does not do' : 'What it does not do'}</Hop>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr', columnGap: 64, rowGap: v ? 40 : 40, marginTop: 40}}>
        {LIMITS().map(([lab, big, sub, delta], i) => (
          <div key={lab} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, l.rows + i * 0.3)}}>
            <Lab color={P.ink}>{lab}</Lab>
            <div style={{display: 'flex', alignItems: 'flex-start', gap: 32, marginTop: 16}}>
              <Px size={S.l}>{big}</Px>
              {delta && <Px size={S.l} color={P.vermilion}>{delta}</Px>}
            </div>
            <Lab style={{marginTop: 16}}>{sub}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const CMD: [string, string][] = [
  ['./serve.sh', 'default, 64k'],
  ['MX_PROFILE=short ./serve.sh', 'q8_0 KV, short chats'],
  ['VARIANT=uncensored ./serve.sh', 'LoRA, half speed'],
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
          <div key={key} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '460px 1fr', rowGap: 8, padding: v ? '20px 0' : '12px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, r.credits + i * 0.15)}}>
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
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['cache', Cache], ['kv', Kv], ['prefill', Prefill], ['limits', Limits], ['run', Run]];
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
export const MxLight: React.FC = () => <Launch theme="light" />;
export const MxDark: React.FC = () => <Launch theme="dark" />;
