import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  AD, Arr, BASE, CHIP, CREDITS, D, DER, Glyph, HOP, HW1, HW2, Hop, Lab, MODEL, MONO, Mark, P, Px, S, STATUS, TBD, Tick, type Theme, TypeOn,
  URL, V, VAR, carry, cells, count, fmt, has, mono, on, pct, rise, setTheme, show, useFonts, useV,
} from './kit';

// Inkling-2-Mini uncensored on a 3060, in the Inkling / Qwen family poster style.
//   01 the result · 02 refusal probe · 03 what the edit costs (KLD) · 04 speed by variant · 05 what fits · 06 run it · dh card.
// Every number comes from data.json (tools/prep.py checks each against runs/). Nulls print as a dash.

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
export type SceneP = {t: number};

/** Display names: Tick 35 words (no digits), and a Stem 7 sub-label. */
export const NAME: Record<string, string> = {
  base: 'UNEDITED', atomicchat: 'ATOMICCHAT BAKED', 'nokeepai-merged': 'NOKEEPAI MERGED', nokeepai: 'NOKEEPAI LORA', 'atomicchat-lora': 'ATOMICCHAT LORA',
};
export const SUB: Record<string, string> = {
  base: 'GGML-ORG IQ4_NL',
  atomicchat: `AD-Q4_K · ${fmt(D.facts.ad_q4k_gb, 1)} GB`,
  'nokeepai-merged': `MERGED · ${fmt(D.facts.merged_gb, 1)} GB`,
  nokeepai: `RANK ${D.facts.nokeepai_rank} · AT RUNTIME`,
  'atomicchat-lora': `RANK ${D.facts.atomicchat_rank} · AT RUNTIME`,
};
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
const CHAPTERS: [string, string][] = [['hook', 'THE RESULT'], ['probe', 'REFUSAL PROBE'], ['cost', 'WHAT THE EDIT COSTS'], ['speed', 'SPEED BY VARIANT'], ['fit', 'WHAT FITS'], ['run', 'RUN IT']];
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

// ---------- shared figures (the stills use these too) ----------

/** n cells: answered (cobalt), hedged (muted), refused (outline). Built one cell at a time from t0. */
export const ProbeCells: React.FC<{r: any; cell: number; h: number; gap: number; t: number; t0: number}> = ({r, cell, h, gap, t, t0}) => {
  const n = r?.n ?? 20;
  const shown = cells(t, t0, n, 0.03);
  return (
    <div style={{display: 'flex', gap}}>
      {Array.from({length: n}, (_, i) => {
        const kind = !r ? 'none' : i < r.answered ? 'ans' : i < r.answered + r.hedged ? 'hedge' : 'ref';
        const lit = i < shown;
        const bg = !lit ? 'transparent' : kind === 'ans' ? P.cobalt : kind === 'hedge' ? P.muted : 'transparent';
        return <div key={i} style={{width: cell, height: h, boxSizing: 'border-box', background: bg, border: lit && bg !== 'transparent' ? 'none' : `2px solid ${P.rule}`}} />;
      })}
    </div>
  );
};
export const ProbeKey: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div style={{display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', rowGap: 16, ...style}}>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: P.cobalt}} /><Tick color={P.muted}>answered</Tick></div>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: P.muted}} /><Tick color={P.muted}>hedged: opens with a refusal</Tick></div>
  </div>
);
export const ProbeRows: React.FC<{t: number; t0: number; v: boolean; cell: number; h: number; gap: number; num: number; pad: number; nameW?: number; ids?: string[]}> = ({t, t0, v, cell, h, gap, num, pad, nameW = 440, ids}) => (
  <div style={{borderTop: `4px solid ${P.ink}`}}>
    {(ids ? ids.map((i) => V[i]) : VAR).map((x: any, i: number) => {
      const ti = t0 + i * 0.25;
      const r = x.refusal;
      const name = <div><Tick color={x.id === 'base' ? P.muted : P.ink}>{NAME[x.id]}</Tick></div>;
      const val = <Px size={num} color={x.id === 'base' ? P.muted : P.ink} style={{minWidth: num * 3, textAlign: 'right'}}>{r ? `${r.answered}/${r.n}` : TBD}</Px>;
      return (
        <div key={x.id} style={{padding: `${pad}px 0`, borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
          {v ? (
            <>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>{name}{val}</div>
              <div style={{marginTop: 16}}><ProbeCells r={r} cell={cell} h={h} gap={gap} t={t} t0={ti} /></div>
            </>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: `${nameW}px max-content 1fr`, columnGap: 40, alignItems: 'center'}}>
              {name}
              <ProbeCells r={r} cell={cell} h={h} gap={gap} t={t} t0={ti} />
              <div style={{justifySelf: 'end'}}>{val}</div>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

/** A horizontal bar on a shared scale, growing from 0 (k = 0..1). */
const HBar: React.FC<{value: number | null; max: number; k: number; h: number; color: string}> = ({value, max, k, h, color}) => (
  <div style={{position: 'relative', height: h, width: '100%'}}>
    <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(has(value) ? (value as number) / max : 0) * k * 100}%`, background: color}} />
  </div>
);
export const KLD_IDS = ['base', 'atomicchat', 'atomicchat-lora', 'nokeepai-merged', 'nokeepai'];
const kldMax = Math.max(...VAR.map((x: any) => x.kld?.[0] ?? 0));
export const KldRows: React.FC<{t: number; t0: number; v: boolean; num: number; barH: number; pad: number; nameW?: number}> = ({t, t0, v, num, barH, pad, nameW = 440}) => (
  <div style={{borderTop: `4px solid ${P.ink}`}}>
    {KLD_IDS.map((id, i) => {
      const x = V[id];
      const ti = t0 + i * 0.25;
      const k = carry(t, ti + 0.1, 0.6);
      const col = id === 'base' ? P.muted : P.cobalt;
      const val = <Px size={num} color={id === 'base' ? P.muted : P.ink} style={{minWidth: num * 4, textAlign: 'right'}}>{fmt(x.kld?.[0], id === 'base' ? 4 : 3)}</Px>;
      return (
        <div key={id} style={{padding: `${pad}px 0`, borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
          {v ? (
            <>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><Tick color={id === 'base' ? P.muted : P.ink}>{NAME[id]}</Tick>{val}</div>
              <div style={{marginTop: 16}}><HBar value={x.kld?.[0]} max={kldMax} k={k} h={barH} color={col} /></div>
            </>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: `${nameW}px 1fr max-content`, columnGap: 40, alignItems: 'center'}}>
              <Tick color={id === 'base' ? P.muted : P.ink}>{NAME[id]}</Tick>
              <HBar value={x.kld?.[0]} max={kldMax} k={k} h={barH} color={col} />
              {val}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export const SPEED_IDS = ['base', 'atomicchat', 'nokeepai-merged', 'nokeepai', 'atomicchat-lora'];
const spMax = Math.max(...VAR.map((x: any) => x.decode ?? 0));
export const SpeedRows: React.FC<{t: number; t0: number; v: boolean; num: number; barH: number; pad: number; nameW?: number; sub?: boolean}> = ({t, t0, v, num, barH, pad, nameW = 440, sub = true}) => (
  <div style={{borderTop: `4px solid ${P.ink}`}}>
    {SPEED_IDS.map((id, i) => {
      const x = V[id];
      const ti = t0 + i * 0.25;
      const k = carry(t, ti + 0.1, 0.6);
      const runtime = x.how === 'runtime';
      const worst = id === 'atomicchat-lora';
      const delta = runtime ? <Px size={num} color={worst ? P.vermilion : P.cobaltText} style={{minWidth: num * 3.2, textAlign: 'right', ...show(t, ti + 0.7)}}>{pct(x.vs_control_pct)}</Px> : <div style={{minWidth: num * 3.2}} />;
      const val = <Px size={num} color={id === 'base' ? P.muted : P.ink} style={{minWidth: num * 3, textAlign: 'right'}}>{count(x.decode, t, ti + 0.1, 1, 0, 0.6)}</Px>;
      const name = <div><Tick color={id === 'base' ? P.muted : P.ink}>{NAME[id]}</Tick>{sub && <Lab style={{marginTop: 10}}>{SUB[id]}</Lab>}</div>;
      return (
        <div key={id} style={{padding: `${pad}px 0`, borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
          {v ? (
            <>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>{name}<div style={{display: 'flex', gap: 24}}>{val}{runtime && delta}</div></div>
              <div style={{marginTop: 16}}><HBar value={x.decode} max={spMax} k={k} h={barH} color={id === 'base' ? P.muted : P.cobalt} /></div>
            </>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: `${nameW}px 1fr max-content max-content`, columnGap: 40, alignItems: 'center'}}>
              {name}
              <HBar value={x.decode} max={spMax} k={k} h={barH} color={id === 'base' ? P.muted : P.cobalt} />
              {val}
              {delta}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

// ---------- 01 · the result ----------
const Hook: React.FC<SceneP> = ({t}) => {
  const h = tl.hook;
  const v = useV();
  const r0 = BASE.refusal, r1 = AD.refusal;
  const sec = v ? S.xl : S.l;
  return (
    <Body>
      <div style={rise(t, h.head)}>
        <Lab color={P.cobaltText}>{v ? `ATOMICCHAT AD-Q4_K · ${ctxK(D.facts.ctx)} CTX` : `ATOMICCHAT'S BAKED AD-Q4_K · ${ctxK(D.facts.ctx)} CTX · THE BASE RECIPE'S LAYOUT`}</Lab>
        <Hop size={S.l} style={{marginTop: 24}}>{v ? `${MODEL},\nuncensored, on a\n12 GB RTX 3060` : `${MODEL}, uncensored, on a 12 GB RTX 3060`}</Hop>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 48 : 40, paddingTop: 24, ...show(t, h.nums)}}>
        <Lab>{v ? `PROBE ANSWERED, OF ${r1?.n ?? TBD}` : `REFUSAL PROBE · ANSWERED OF ${r1?.n ?? TBD} · UNEDITED → EDITED`}</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 40 : 56, marginTop: 32}}>
          <Px size={S.x240} color={P.muted}>{r0 ? String(r0.answered) : TBD}</Px>
          <Arr size={S.x240} t={t} t0={h.nums + 0.15} />
          <Px size={S.x240} color={P.vermilion} style={show(t, h.nums + 0.35)}>{r1 ? count(r1.answered, t, h.nums + 0.35, 0, r0?.answered ?? 0) : TBD}</Px>
        </div>
        <Lab style={{marginTop: 24, ...show(t, h.nums + 0.6)}}>{v ? `UNEDITED: ${r0?.hedged} OF ${r0?.n} HEDGED` : `THE UNEDITED MODEL HEDGED ON ${r0?.hedged} OF ${r0?.n}`}</Lab>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : 'max-content max-content', columnGap: 96, rowGap: 40, marginTop: v ? 56 : 40}}>
        <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 20, ...show(t, h.dec)}}>
          <Lab>DECODE TOK/S · UNEDITED → EDITED</Lab>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 20}}>
            <Px size={sec} color={P.muted}>{fmt(BASE.decode, 1)}</Px><Arr size={sec} t={t} t0={h.dec + 0.1} /><Px size={sec}>{fmt(AD.decode, 1)}</Px>
          </div>
        </div>
        <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 20, ...show(t, h.kld)}}>
          <Lab>KLD VS Q8_0 · UNEDITED → EDITED</Lab>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 20}}>
            <Px size={S.l} color={P.muted}>{fmt(BASE.kld?.[0], 4)}</Px><Arr size={S.l} t={t} t0={h.kld + 0.1} /><Px size={S.l}>{fmt(AD.kld?.[0], 3)}</Px>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · refusal probe ----------
const Probe: React.FC<SceneP> = ({t}) => {
  const p = tl.probe;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, p.in)}>{v ? `${BASE.refusal?.n} borderline prompts,\nevery answer read` : `${BASE.refusal?.n} borderline prompts, every answer read`}</Hop>
      <Lab style={{marginTop: 20, ...show(t, p.in + 0.2)}}>{v ? 'TEMP 0 · REASONING LOW' : 'SCRIPTS/REFUSAL_PROBE.PY · TEMP 0 · REASONING EFFORT LOW'}</Lab>
      <div style={{marginTop: 32}}>
        <ProbeRows t={t} t0={p.rows} v={v} cell={v ? 42 : 46} h={v ? 56 : 56} gap={v ? 7 : 8} num={S.m} pad={v ? 28 : 18} nameW={420} />
      </div>
      <ProbeKey style={{marginTop: 28, ...show(t, p.rows)}} />
      <div style={show(t, p.code)}><Lab color={P.ink} style={{marginTop: 28}}>{`CODEEVAL ${AD.codeeval?.join('/')} ON EVERY VARIANT${v ? '' : ' · NO GARBAGE, NO LOOPS'}`}</Lab>{v && <Lab color={P.ink} style={{marginTop: 8}}>NO GARBAGE, NO LOOPS</Lab>}</div>
    </Body>
  );
};

// ---------- 03 · what the edit costs ----------
const Cost: React.FC<SceneP> = ({t}) => {
  const c = tl.cost;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, c.in)}>{v ? 'What each edit costs:\ndistance from Q8_0' : 'What each edit costs: distance from Q8_0'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, c.in + 0.2)}}>{v ? 'MEAN KLD · WIKITEXT · 24 × 512 TOKENS' : 'MEAN KLD VS GGML-ORG Q8_0 · WIKITEXT-2 · 24 × 512 TOKENS · LOWER IS CLOSER'}</Lab>
      <div style={{marginTop: 32}}><KldRows t={t} t0={c.rows} v={v} num={S.m} barH={v ? 40 : 40} pad={v ? 32 : 22} nameW={420} /></div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 16 : 32, marginTop: v ? 48 : 40, borderTop: `4px solid ${P.ink}`, paddingTop: 24, ...show(t, c.ratio)}}>
        <Px size={S.xl} color={P.vermilion}>{has(DER.kld_ratio) ? `${Math.round(DER.kld_ratio)}×` : TBD}</Px>
        <div style={{marginBottom: v ? 0 : 12}}>
          <Lab color={P.ink}>NOKEEPAI'S EDIT MOVES THE OUTPUT</Lab>
          <Lab color={P.ink} style={{marginTop: 8}}>{`${Math.round(DER.kld_ratio)}× AS FAR AS ATOMICCHAT'S`}</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 04 · speed by variant ----------
const Speed: React.FC<SceneP> = ({t}) => {
  const s = tl.speed;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, s.in)}>{v ? 'Baked or merged:\nbase speed.\nLoRA at runtime:\nslower.' : 'Baked or merged: base speed. LoRA at runtime: slower.'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, s.in + 0.2)}}>{v ? 'DECODE TOK/S · VS UNEDITED CONTROLS' : 'DECODE TOK/S · EACH ROW BETWEEN TWO UNEDITED CONTROLS'}</Lab>
      <div style={{marginTop: 32}}><SpeedRows t={t} t0={s.rows} v={v} num={S.m} barH={v ? 32 : 32} pad={v ? 24 : 16} nameW={460} /></div>
    </Body>
  );
};

// ---------- 05 · what fits ----------
const Fit: React.FC<SceneP> = ({t}) => {
  const f = tl.fit;
  const v = useV();
  const nd = AD.needles as [string, string][];
  const cols: [string, string, string][] = [
    ['DECODE AT 32K', fmt(AD.decode_32k, 1), 'TOK/S'],
    ['NEEDLES', nd.map((n) => n[1]).join(' · '), `AT ${nd.map((n) => n[0].toUpperCase()).join(' / ')}`],
    ['IMAGE INPUT', AD.image?.pass ? 'PASS' : TBD, 'UNC_MMPROJ=1'],
  ];
  return (
    <Body>
      <Hop size={S.l} style={rise(t, f.in)}>{v ? `${ctxK(D.facts.ctx)} context\nin 12 GB of VRAM` : `${ctxK(D.facts.ctx)} context in 12 GB of VRAM`}</Hop>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : 'max-content max-content max-content', columnGap: 96, rowGap: 32, marginTop: 40}}>
        {cols.map(([lab, big, sub], i) => (
          <div key={lab} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, f.cols + i * 0.3)}}>
            <Lab color={P.ink}>{lab}</Lab>
            <Px size={S.xl} style={{marginTop: 16}}>{big}</Px>
            <Lab style={{marginTop: 16}}>{sub}</Lab>
          </div>
        ))}
      </div>
      <div style={{borderTop: `2px solid ${P.ink}`, paddingTop: 24, marginTop: v ? 56 : 56, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, ...show(t, f.stock)}}>
        <div style={{background: P.vermilion, padding: '8px 16px'}}><Px size={S.m} color={P.ink}>CARD LINE: NO LOAD</Px></div>
        <div>
          <Lab color={P.ink}>{v ? '-NGL 99 -C 32768 ASKS FOR' : `-NGL 99 -C 32768 ASKS FOR ${fmt(D.stock.card_line_mib[0])}–${fmt(D.stock.card_line_mib[1])} MIB ON THE GPU`}</Lab>
          {v && <Lab color={P.ink} style={{marginTop: 8}}>{`${fmt(D.stock.card_line_mib[0])}–${fmt(D.stock.card_line_mib[1])} MIB ON THE GPU`}</Lab>}
          <Lab style={{marginTop: 8}}>{v ? `EXPERTS-IN-RAM LINE: ${fmt(D.stock.decode, 1)} TOK/S` : `USUAL EXPERTS-IN-RAM LINE: ${fmt(D.stock.decode, 1)} TOK/S · THIS LAYOUT: ${(DER.speedup_decode as number).toFixed(2)}×`}</Lab>
          {v && <Lab style={{marginTop: 8}}>{`THIS LAYOUT: ${(DER.speedup_decode as number).toFixed(2)}×`}</Lab>}
        </div>
      </div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const CMD: [string, string][] = [
  ['./serve.sh', 'AtomicChat AD-Q4_K, 64k'],
  ['UNC_MMPROJ=1 ./serve.sh', 'with image input'],
  ['VARIANT=nokeepai-merged ./serve.sh', 'nokeepai, base speed'],
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
          <div style={{...mono(v ? sz : 48), width: v ? undefined : 1000}}><TypeOn text={c} t={t} t0={r.cmd + 0.2 + i * 0.15} rate={0.008} /></div>
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
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['probe', Probe], ['cost', Cost], ['speed', Speed], ['fit', Fit], ['run', Run]];
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
export const UncLight: React.FC = () => <Launch theme="light" />;
export const UncDark: React.FC = () => <Launch theme="dark" />;
