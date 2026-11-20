import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from '../timeline.json';
import {CHIP, Glyph, TypeOn, arrive, carry, cells, on} from '../house';
import {Arr, Body, Mark, setTheme, type Theme, CellBar, CellColumns, Chrome, D, LinePlot, Lab, P, Px, S, count, fmt, mono, pct, show, times, useFonts3, useV} from './kit';

// Flint launch, v3. Two directions on one timeline and one data file:
//   A · Ledger: the current plates, every number set in Stem 7 on an aligned board, scaled to fill the frame.
//   B · Poster: one number owns each plate at 240 px; the rest steps down to 120 and 72.
// Both: Stem 7 everywhere except command and flag lines (IBM Plex Mono). Two inks, vermilion once per frame.

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
type Variant = 'A' | 'B';
type SceneP = {t: number; x: Variant};

const MODEL = `Flint 40B-A${D.model.active_b}B`;
const KICK = 'LLAMA.CPP RECIPE · Q4_K_M · 128K CTX';
const rise = (t: number, t0: number): React.CSSProperties => ({opacity: arrive(t, t0, 0.4), transform: `translateY(${Math.round((1 - arrive(t, t0, 0.4)) * 16)}px)`});

// The two hook metrics, from data.json.
const PP = {from: D.ttft.old_tps as number, to: D.ttft.new_tps as number, delta: times(D.ttft.old_tps, D.ttft.new_tps)};
const TG = {from: Math.round(D.decode.old_prose), to: Math.round(D.decode.new_prose), delta: pct(D.decode.old_prose, D.decode.new_prose)};
const KV = {from: D.kv.q8_32k.toFixed(1), to: D.decode.new_32k.toFixed(1), delta: pct(D.kv.q8_32k, D.decode.new_32k)};

/** before → after delta, as grid cells (the parent grid aligns them across metrics). */
const Figures: React.FC<{size: number; t: number; t0: number; m: typeof PP; focal?: boolean; split?: boolean}> = ({size, t, t0, m, focal, split}) => (
  <>
    <Px size={size} color={P.muted} style={{justifySelf: 'end'}}>{fmt(m.from)}</Px>
    <Arr size={size} t={t} t0={t0 + 0.15} />
    <Px size={size} style={{justifySelf: 'start', ...show(t, t0 + 0.35)}}>{count(m.to, t, t0 + 0.35, 0, m.from)}</Px>
    <Px size={size} color={focal ? P.vermilion : P.cobalt} style={{justifySelf: split ? 'start' : 'end', ...(split ? {gridColumn: 3} : {}), ...show(t, tl.hook.delta)}}>{m.delta}</Px>
  </>
);

// ---------- 01 · hook ----------

const Hook: React.FC<SceneP> = ({t, x}) => {
  const h = tl.hook;
  const v = useV();
  if (x === 'A') {
    // Ledger: one board, columns aligned across pp and tg (tabular figures right-aligned by place value).
    const size = v ? S.x128 : S.x160;
    const row = (label: string, m: typeof PP, t0: number, focal?: boolean) => (
      <div style={{borderTop: `4px solid ${P.ink}`, paddingTop: 24, paddingBottom: v ? 40 : 32, ...show(t, t0)}}>
        <Lab>{label}</Lab>
        <div style={{display: 'grid', gridTemplateColumns: v ? `${size * 18 / 8}px max-content ${size * 27 / 8}px` : `${size * 18 / 8}px max-content ${size * 27 / 8}px 1fr`, columnGap: v ? size * 2 / 8 : size * 3 / 8, rowGap: v ? 48 : 0, marginTop: 24, alignItems: 'start'}}>
          <Figures size={size} t={t} t0={t0} m={m} focal={focal} split={v} />
        </div>
      </div>
    );
    return (
      <Body>
        <div style={rise(t, h.head)}>
          <Lab color={P.cobaltText}>{KICK}</Lab>
          <Px size={S.l} style={{marginTop: v ? 24 : 16, whiteSpace: 'pre-wrap', lineHeight: '88px'}}>{v ? `${MODEL}\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Px>
        </div>
        <div style={{marginTop: v ? 64 : 32}}>
          {row('PREFILL · TOK/S · 11K PROMPT', PP, h.pp, true)}
          {row('DECODE · TOK/S', TG, h.tg)}
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 20, display: 'flex', alignItems: 'center', gap: 32, ...show(t, h.delta)}}>
            <Lab>TG @ 32K DEPTH</Lab>
            <Px size={S.m} color={P.muted}>{KV.from}</Px><Arr size={S.m} /><Px size={S.m}>{KV.to}</Px><Px size={S.m} color={P.cobalt}>{KV.delta}</Px>
          </div>
        </div>
      </Body>
    );
  }
  // Poster: pp owns the frame at 240; tg and the 32k line step down to 120 and 48, each with its own arrow and delta.
  const big = S.x240;
  const tgRow = (
    <div style={show(t, h.tg)}>
      <Lab>DECODE · TOK/S</Lab>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 45, marginTop: v ? 16 : 20}}>
        <Px size={S.xl} color={P.muted}>{fmt(TG.from)}</Px><Arr size={S.xl} t={t} t0={h.tg + 0.15} /><Px size={S.xl}>{count(TG.to, t, h.tg + 0.35, 0, TG.from)}</Px>
        <Px size={S.xl} color={P.cobalt} style={{marginLeft: 30, ...show(t, h.delta)}}>{TG.delta}</Px>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: v ? 16 : 32, ...show(t, h.delta)}}>
        <Lab>TG @ 32K</Lab>
        <Px size={S.m} color={P.muted}>{KV.from}</Px><Arr size={S.m} /><Px size={S.m}>{KV.to}</Px><Px size={S.m} color={P.cobalt}>{KV.delta}</Px>
      </div>
    </div>
  );
  return (
    <Body align={v ? 'top' : 'center'}>
      <div style={rise(t, h.head)}>
        {!v && <Lab color={P.cobaltText} style={{marginBottom: 24}}>{KICK}</Lab>}
        <Px size={v ? S.m : S.l} style={{whiteSpace: 'pre-wrap', lineHeight: v ? '64px' : '88px'}}>{v ? `${MODEL} · Q4_K_M\non a 12 GB RTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Px>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 24 : 40, paddingTop: v ? 16 : 24, ...show(t, h.pp)}}>
        <Lab>PREFILL · TOK/S · 11K PROMPT</Lab>
        {v ? (
          <div style={{marginTop: 24}}>
            <div style={{display: 'flex', gap: 60}}><Px size={big} color={P.muted}>{fmt(PP.from)}</Px><Arr size={big} t={t} t0={h.pp + 0.15} /></div>
            <Px size={big} style={{marginTop: 16, ...show(t, h.pp + 0.35)}}>{count(PP.to, t, h.pp + 0.35, 0, PP.from)}</Px>
            <Px size={big} color={P.vermilion} style={{marginTop: 40, ...show(t, h.delta)}}>{PP.delta}</Px>
          </div>
        ) : (
          <div style={{display: 'flex', gap: 60, marginTop: 32}}>
            <Px size={big} color={P.muted}>{fmt(PP.from)}</Px><Arr size={big} t={t} t0={h.pp + 0.15} /><Px size={big} style={show(t, h.pp + 0.35)}>{count(PP.to, t, h.pp + 0.35, 0, PP.from)}</Px>
          </div>
        )}
      </div>
      {v ? (
        <div style={{borderTop: `2px solid ${P.rule}`, marginTop: 32, paddingTop: 16}}>{tgRow}</div>
      ) : (
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 48}}>
          <Px size={big} color={P.vermilion} style={show(t, h.delta)}>{PP.delta}</Px>
          <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 24, width: 1020}}>{tgRow}</div>
        </div>
      )}
    </Body>
  );
};

// ---------- 02 · bench ----------

const ROWS = () => {
  const last = D.prefill_steps[D.prefill_steps.length - 1].tps;
  const first = D.prefill_steps[0].tps;
  return [
    {name: 'TTFT 11k', unit: 'SECONDS', a: D.ttft.old_s, z: D.ttft.new_s, dp: 1, d: `${(D.ttft.old_s / D.ttft.new_s).toFixed(1)}×`, lower: true},
    {name: 'pp 11k', unit: 'TOK/S', a: D.ttft.old_tps, z: D.ttft.new_tps, dp: 0, d: times(D.ttft.old_tps, D.ttft.new_tps), focal: true},
    {name: 'tg', unit: 'TOK/S', a: D.decode.old_prose, z: D.decode.new_prose, dp: 1, d: pct(D.decode.old_prose, D.decode.new_prose)},
    {name: 'tg @ 32k', unit: 'TOK/S', a: D.kv.q8_32k, z: D.decode.new_32k, dp: 1, d: pct(D.kv.q8_32k, D.decode.new_32k)},
  ] as {name: string; unit: string; a: number; z: number; dp: number; d: string; lower?: boolean; focal?: boolean}[];
};
const Key: React.FC = () => (
  <div style={{display: 'flex', gap: 40}}>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: P.rule}} /><Lab>STOCK</Lab></div>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: P.cobalt}} /><Lab color={P.ink}>TUNED</Lab></div>
  </div>
);

/** Stock (rule grey) and tuned (cobalt) as two bars on one scale; the tuned bar grows (or shrinks, for TTFT) from the stock length. */
const PairBars: React.FC<{a: number; z: number; t: number; t0: number; v: boolean}> = ({a, z, t, t0, v}) => {
  const max = Math.max(a, z);
  const k = carry(t, t0 + 0.25, 0.7);
  const tw = (a + (z - a) * k) / max;
  const hh = v ? 16 : 14;
  return (
    <div style={{gridColumn: '1 / -1', display: 'grid', gap: 6, paddingBottom: v ? 24 : 14, ...show(t, t0)}}>
      <div style={{width: `${(a / max) * 100}%`, height: hh, background: P.rule}} />
      <div style={{width: `${tw * 100}%`, height: hh, background: P.cobalt, ...show(t, t0 + 0.25)}} />
    </div>
  );
};

const Bench: React.FC<SceneP> = ({t, x}) => {
  const b = tl.bench;
  const v = useV();
  const rows = ROWS();
  if (x === 'A') {
    // Ledger: the bar chart, names, values and Δ in Stem 7 48, Δ in its own column.
    const barMax = v ? 700 : 1040;
    const bar = (val: number, max: number, hot: boolean, k: number, t0: number, dp: number, unitS: boolean) => (
      <div style={{display: 'flex', alignItems: 'center', gap: 16, height: 48}}>
        <div style={{width: Math.round((val / max) * barMax * k), height: 48, background: hot ? P.cobalt : P.rule}} />
        <Px size={S.m} color={hot ? P.ink : P.muted} style={show(t, t0 + 0.3)}>{`${fmt(val, dp)}${unitS ? ' s' : ''}`}</Px>
      </div>
    );
    return (
      <Body>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, ...rise(t, b.in)}}>
          <Px size={S.l}>Stock flags vs tuned</Px>
          <Key />
        </div>
        <div style={{display: 'grid', gridTemplateColumns: v ? '1fr max-content' : '300px 1fr max-content', columnGap: 32, rowGap: v ? 16 : 32, marginTop: v ? 56 : 48, alignItems: 'center'}}>
          {rows.map((r, i) => {
            const t0 = b.rows + i * 0.25;
            const max = Math.max(r.a, r.z);
            const k = carry(t, t0, 0.5);
            const bars = <div style={{display: 'grid', gap: 8, ...(v ? {gridColumn: '1 / -1', marginBottom: 32} : {})}}>{bar(r.a, max, false, k, t0, r.dp, !!r.lower)}{bar(r.z, max, true, k, t0, r.dp, !!r.lower)}</div>;
            return (
              <React.Fragment key={r.name}>
                <Px size={S.m} style={show(t, t0)}>{r.name}</Px>
                {!v && bars}
                <Px size={S.m} color={r.focal ? P.vermilion : P.cobalt} style={{justifySelf: 'end', ...show(t, t0 + 0.4)}}>{r.d}</Px>
                {v && bars}
              </React.Fragment>
            );
          })}
        </div>
      </Body>
    );
  }
  // Poster: the whole table as a scoreboard. Stock → tuned → Δ at 120 (16:9) / 72 (9:16), right-aligned by place value.
  const size = v ? S.l : S.xl;
  const c = size / 8;
  return (
    <Body>
      {v && <Px size={S.xl} style={{whiteSpace: 'pre', marginBottom: 56, ...rise(t, b.in)}}>{'Stock flags\nvs tuned'}</Px>}
      <div style={{display: 'grid', gridTemplateColumns: v ? `${c * 20}px max-content ${c * 27}px 1fr` : `1fr ${c * 20}px max-content ${c * 27}px ${c * 24}px`, columnGap: v ? c * 4 : c * 4, alignItems: 'start'}}>
        {!v && <><div /><Lab style={{justifySelf: 'end'}}>STOCK</Lab><div /><Lab color={P.cobaltText} style={{justifySelf: 'end'}}>TUNED</Lab><Lab style={{justifySelf: 'end'}}>Δ</Lab></>}
        {rows.map((r, i) => {
          const t0 = b.rows + i * 0.25;
          const pad: React.CSSProperties = v ? {paddingBottom: 20} : {padding: '10px 0'};
          return (
            <React.Fragment key={r.name}>
              <div style={{gridColumn: '1 / -1', height: 2, background: i === 0 ? P.ink : P.faint, marginTop: !v && i === 0 ? 16 : 0}} />
              {v ? (
                <div style={{gridColumn: '1 / -1', padding: '20px 0 16px', ...show(t, t0)}}><Lab>{`${r.name.toUpperCase()} · ${r.unit}`}</Lab></div>
              ) : (
                <div style={{...pad, ...show(t, t0)}}>
                  <Px size={S.m}>{r.name}</Px>
                  <Lab style={{marginTop: 16}}>{r.unit}</Lab>
                </div>
              )}
              <div style={{...pad, textAlign: 'right', ...show(t, t0)}}><Px size={size} color={P.muted}>{fmt(r.a, r.dp)}</Px></div>
              <div style={{...pad, ...show(t, t0)}}><Arr size={size} t={t} t0={t0 + 0.1} /></div>
              <div style={{...pad, textAlign: 'right', ...show(t, t0 + 0.25)}}><Px size={size}>{fmt(r.z, r.dp)}</Px></div>
              <div style={{...pad, textAlign: 'right', ...show(t, t0 + 0.4)}}><Px size={size} color={r.focal ? P.vermilion : P.cobalt}>{r.d}</Px></div>
              <PairBars a={r.a} z={r.z} t={t} t0={t0} v={v} />
            </React.Fragment>
          );
        })}
      </div>
    </Body>
  );
};

// ---------- 03 · flags ----------

const FLAGS = (): {flag: string; metric: string; val: string; big: string}[] => [
  {flag: '-b 4096 -ub 4096', metric: 'pp', val: '4.1×', big: 'PP'},
  {flag: '--load-mode none', metric: 'pp', val: '+24%', big: 'PP'},
  {flag: '-ctk f16 -ctv f16', metric: 'tg @ 32k', val: '+29%', big: 'TG @ 32K'},
  {flag: '-cmoe --moe-cache-mib 2944', metric: 'tg', val: `+${D.cache.tg_gain_pct}%`, big: 'TG, HOT EXPERTS IN VRAM'},
  {flag: '--spec-type ngram-map-k', metric: 'tg up to', val: `${Math.round(D.decode.spec_best)} on code`, big: 'TG ON CODE, UP TO'},
];
const Flags: React.FC<SceneP> = ({t, x}) => {
  const f = tl.flags;
  const v = useV();
  const rows = FLAGS();
  if (x === 'A') {
    return (
      <Body>
        <Px size={S.l} style={rise(t, f.in)}>Five flags. No patches.</Px>
        <div style={{borderTop: `4px solid ${P.ink}`, marginTop: 48}}>
          {rows.map((r, i) => {
            const t0 = f.rows + i * 0.3;
            return (
              <div key={r.flag} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '840px 1fr', alignItems: 'baseline', rowGap: 16, padding: v ? '28px 0' : '20px 0', borderBottom: `2px solid ${P.faint}`}}>
                <div style={mono(48, P.cobaltText, 600)}><TypeOn text={r.flag} t={t} t0={t0} rate={0.012} /></div>
                <div style={{display: 'flex', gap: 27, ...show(t, t0 + 0.25)}}>
                  <Px size={S.l}>{r.metric}</Px>
                  <Px size={S.l} color={i === 0 ? P.vermilion : P.ink}>{r.val}</Px>
                </div>
              </div>
            );
          })}
        </div>
      </Body>
    );
  }
  // Poster: what each flag bought, as a number, then the flag that bought it.
  return (
    <Body>
      <Px size={S.l} style={rise(t, f.in)}>Five flags. No patches.</Px>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: 40}}>
        {rows.map((r, i) => {
          const t0 = f.rows + i * 0.3;
          const val = i === 4 ? String(Math.round(D.decode.spec_best)) : r.val;
          return (
            <div key={r.flag} style={{display: 'grid', gridTemplateColumns: '360px 1fr', columnGap: 45, rowGap: 8, alignItems: 'center', padding: v ? '16px 0 20px' : '12px 0', borderBottom: `2px solid ${P.faint}`}}>
              <Px size={S.xl} color={i === 0 ? P.vermilion : P.ink} style={{justifySelf: 'end', ...show(t, t0 + 0.25)}}>{val}</Px>
              <div>
                <Lab style={show(t, t0 + 0.25)}>{r.big}</Lab>
                {!v && <div style={{...mono(48, P.cobaltText, 600), marginTop: 8}}><TypeOn text={r.flag} t={t} t0={t0} rate={0.012} /></div>}
              </div>
              {v && <div style={{...mono(48, P.cobaltText, 600), gridColumn: '1 / -1'}}><TypeOn text={r.flag} t={t} t0={t0} rate={0.012} /></div>}
            </div>
          );
        })}
      </div>
    </Body>
  );
};

// ---------- 04 · long context ----------

const Ctx: React.FC<SceneP> = ({t, x}) => {
  const c = tl.ctx;
  const v = useV();
  const vram = D.needles.vram_mib / 1024;
  const stats = [
    {k: 'NIAH @ 120K', val: `${D.needles.k120}`, sub: `also ${D.needles.k60} @ 60k`, kv: `NIAH @ 120K · ALSO ${D.needles.k60} @ 60K`},
    {k: 'PP @ 120K', val: fmt(D.needles.prefill_120k), sub: 'tok/s', kv: 'PP @ 120K · TOK/S'},
    {k: 'VRAM', val: vram.toFixed(1), sub: 'GiB of 12', kv: 'VRAM · GIB OF 12'},
  ];
  if (x === 'A') {
    const size = v ? S.x240 : S.x160;
    return (
      <Body>
        <Px size={v ? S.l : S.xl} style={rise(t, c.in)}>128k context in 12 GB</Px>
        <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : 'repeat(3, 1fr)', columnGap: 48, rowGap: 40, marginTop: v ? 48 : 64}}>
          {stats.map((s, i) => (
            <div key={s.k} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, c.stats + i * 0.3)}}>
              <Lab>{v ? s.kv : s.k}</Lab>
              <Px size={size} style={{marginTop: 16}}>{s.val}</Px>
              {!v && <Px size={S.m} color={P.muted} style={{marginTop: 40}}>{s.sub}</Px>}
              {v && <div style={{height: 32}} />}
            </div>
          ))}
        </div>
      </Body>
    );
  }
  // Poster: needles as the big number, decode by depth drawn on as a line, VRAM as twelve 1 GiB cells.
  const big = v ? S.x160 : S.x240;
  const cellW = 44;
  const k = carry(t, c.stats + 0.2, 1.4);
  const chart = (
    <div style={show(t, c.stats + 0.2)}>
      <div>
        <Lab>TG BY CONTEXT DEPTH · TOK/S</Lab>
        <div style={{display: 'flex', gap: 32, marginTop: 12}}>
          <div style={{display: 'flex', gap: 10, alignItems: 'center'}}><div style={{width: 20, height: 20, background: P.rule}} /><Lab>STOCK</Lab></div>
          <div style={{display: 'flex', gap: 10, alignItems: 'center'}}><div style={{width: 20, height: 20, background: P.cobalt}} /><Lab color={P.ink}>TUNED</Lab></div>
        </div>
      </div>
      <div style={{marginTop: 16}}>
        <LinePlot w={v ? 984 : 900} h={v ? 520 : 600} xmax={128} ymax={60} ystep={20}
          xticks={[[0, '0'], [32, '32K'], [60, '60K'], [120, '120K']]}
          series={[{pts: D.depth.stock, color: P.rule, k: Math.min(1, k * 3.5)}, {pts: D.depth.tuned, color: P.cobalt, k}]}
          valueAt={(s, i) => (s.color === P.cobalt ? fmt(s.pts[i][1], 0) : null)} />
      </div>
    </div>
  );
  const needle = (
    <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, c.stats)}}>
      <Lab>{stats[0].kv}</Lab>
      <Px size={big} style={{marginTop: 16}}>{stats[0].val}</Px>
    </div>
  );
  const vramEl = (
    <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, marginTop: v ? 40 : 56, ...show(t, c.stats + 0.6)}}>
      <Lab>{stats[2].kv}</Lab>
      <div style={{display: 'flex', alignItems: 'center', gap: 32, marginTop: 16}}>
        <Px size={S.xl}>{stats[2].val}</Px>
        <CellBar n={vram * Math.min(1, carry(t, c.stats + 0.7, 0.8))} of={12} cell={cellW} h={v ? 72 : 72} gap={v ? 6 : 6} />
      </div>
    </div>
  );
  return (
    <Body>
      <Px size={S.l} style={rise(t, c.in)}>128k context in 12 GB</Px>
      {v ? (
        <div style={{marginTop: 40}}>{needle}<div style={{marginTop: 40}}>{chart}</div>{vramEl}</div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '1fr 900px', columnGap: 64, marginTop: 40, alignItems: 'start'}}>
          <div>{needle}{vramEl}</div>
          {chart}
        </div>
      )}
    </Body>
  );
};

// ---------- 05 · expert cache ----------

const Cache: React.FC<SceneP> = ({t}) => {
  const c = tl.cache;
  const v = useV();
  const cur = D.cache.curve as {mib: number; tps: number; hit: number}[];
  const bars = cur.map((p, i) => ({
    v: p.tps, k: carry(t, c.bars + i * 0.35, 0.5), hot: i > 0,
    top: fmt(p.tps, 1), under: i === 0 ? 'OFF' : fmt(p.mib), under2: i === 0 ? '' : `${Math.round(p.hit)}% HIT`,
  }));
  const gain = pct(D.cache.ncmoe43_tps, D.cache.curve[cur.length - 1].tps);
  const w = v ? 984 : 1120;
  return (
    <Body>
      <Px size={S.l} style={{whiteSpace: 'pre-wrap', ...rise(t, c.in)}}>{v ? 'Hot experts\nlive in VRAM' : 'Hot experts live in VRAM'}</Px>
      <div style={{display: v ? 'block' : 'grid', gridTemplateColumns: '1fr 1120px', columnGap: 64, marginTop: v ? 40 : 48, alignItems: 'end'}}>
        <div style={show(t, c.in + 0.3)}>
          <Lab>TOP 25% OF EXPERTS</Lab>
          <Px size={S.xl} style={{marginTop: 16}}>{`${D.cache.skew_top25}%`}</Px>
          <Lab style={{marginTop: 16}}>OF ROUTING PICKS ON CODE</Lab>
          <div style={{marginTop: v ? 32 : 64, ...show(t, c.bars + cur.length * 0.35 + 0.3)}}>
            <Lab>{v ? 'TG VS -NCMOE 43, NO CACHE' : 'TG VS -NCMOE 43'}</Lab>
            <Px size={v ? S.xl : S.x160} color={P.vermilion} style={{marginTop: 16}}>{gain}</Px>
          </div>
        </div>
        <div style={{marginTop: v ? 48 : 0}}>
          <Lab>TG · TOK/S BY CACHE SIZE · MIB</Lab>
          <div style={{display: 'flex', gap: 16, alignItems: 'center', marginTop: 12}}>
            <svg width={56} height={8}><line x1={0} x2={56} y1={4} y2={4} stroke={P.ink} strokeWidth={4} strokeDasharray="16 12" /></svg>
            <Lab color={P.ink}>{`-NCMOE 43, NO CACHE · ${fmt(D.cache.ncmoe43_tps, 1)}`}</Lab>
          </div>
          <div style={{marginTop: 16}}>
            <CellColumns w={w} h={v ? 560 : 640} ymax={60} unit={5} bars={bars} refY={{v: D.cache.ncmoe43_tps, label: ''}} />
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 05 · run it ----------

const URL = 'github.com/davidghatley/3060-recipes';
const Run: React.FC<SceneP> = ({t, x}) => {
  const r = tl.run;
  const v = useV();
  const cmd = v
    ? ['llama-server \\', '  -m Flint-Q4_K_M.gguf --jinja \\', '  -ngl 99 -cmoe --fit off \\', '  --moe-cache-mib 2944 \\', '  --moe-cache-cpu-share 0.95 \\', '  -c 131072 -t 6 -b 4096 \\', '  -ub 4096 --load-mode none \\', '  -fa on -ctk f16 -ctv f16 \\', '  --spec-type ngram-map-k']
    : ['llama-server -m Flint-Q4_K_M.gguf -ngl 99 -cmoe --fit off \\', '  --moe-cache-mib 2944 --moe-cache-cpu-share 0.95 \\', '  -c 131072 -t 6 -b 4096 -ub 4096 \\', '  --load-mode none -fa on -ctk f16 -ctv f16 \\', '  --jinja --spec-type ngram-map-k'];
  const credits: [string, string][] = [['MODEL', 'Flint · Recursive'], ['ENGINE', 'llama.cpp · ggml-org'], ['METHOD', 'inference-optimisation · 0xSero']];
  const k = carry(t, r.cmd, 0.5);
  const box = (
    <div style={{background: P.sheet, outline: `2px solid ${P.ink}`, padding: v ? '20px 24px' : '24px 32px', clipPath: k >= 1 ? 'none' : `inset(-4px ${(1 - k) * 100}% -4px -4px)`}}>
      {cmd.map((l, i) => <div key={i} style={mono(48)}><TypeOn text={l} t={t} t0={r.cmd + 0.2 + i * 0.15} rate={0.006} /></div>)}
    </div>
  );
  const big = x === 'B';
  const url = v ? (big ? 'github.com/\ndavidghatley/\n3060-recipes' : 'github.com/davidghatley/\n3060-recipes') : URL;
  const urlEl = <Px size={v && !big ? S.m : S.l} color={P.cobalt} style={{whiteSpace: 'pre', lineHeight: v && !big ? '64px' : '88px', ...show(t, r.cmd + 0.8)}}>{url}</Px>;
  const lockup = (
    <div style={{display: 'flex', alignItems: 'center', gap: big ? 32 : 24, opacity: arrive(t, r.credits + 0.8)}}>
      <Mark cell={big ? (v ? 12 : 16) : 8} />
      <div>
        <Px size={big && !v ? S.l : S.m}>David Hatley</Px>
        <Px size={S.label} color={P.muted} style={{marginTop: big ? 16 : 12}}>design · AI/ML · generative tools</Px>
      </div>
    </div>
  );
  const creditEls = credits.map(([key, val], i) => (
    <div key={key} style={{gridColumn: v && i === 2 ? '1 / -1' : undefined, borderTop: `2px solid ${P.ink}`, paddingTop: 16, ...show(t, r.credits + i * 0.2)}}>
      <Lab>{key}</Lab>
      <Px size={S.label} style={{marginTop: 12}}>{val}</Px>
    </div>
  ));
  if (!big) {
    return (
      <Body>
        {box}
        <div style={{marginTop: 40}}>{urlEl}</div>
        <div style={{display: 'grid', gridTemplateColumns: v ? '1fr 1fr' : 'repeat(3, 1fr)', gap: v ? 32 : 48, marginTop: v ? 48 : 56}}>{creditEls}</div>
        <div style={{display: 'flex', justifyContent: v ? 'flex-start' : 'flex-end', marginTop: v ? 56 : 72}}>{lockup}</div>
      </Body>
    );
  }
  // Poster: the address first and large, the command under it, then credits, then the signature on its own line.
  return (
    <Body>
      {urlEl}
      <div style={{marginTop: v ? 32 : 40}}>{box}</div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr 1fr' : 'repeat(3, 1fr)', columnGap: 48, rowGap: 32, marginTop: v ? 40 : 48}}>{creditEls}</div>
      <div style={{display: 'flex', justifyContent: v ? 'flex-start' : 'flex-end', marginTop: v ? 40 : 48}}>{lockup}</div>
    </Body>
  );
};

// ---------- the dh card (same close as the selfheal video) ----------

const DH = ['...X...', '...X...', '...X...', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXX..X'];
const DhMark: React.FC<{cell: number; n?: number}> = ({cell, n = 99}) => {
  const pts = DH.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  // the stem first, top down, then the bowl and the shoulder
  pts.sort((a, b) => (a[0] === 3 && b[0] !== 3 ? -1 : b[0] === 3 && a[0] !== 3 ? 1 : a[1] - b[1] || a[0] - b[0]));
  return <svg width={cell * 7} height={cell * 7} shapeRendering="crispEdges">{pts.slice(0, n).map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={P.ink} />)}</svg>;
};
const DhCard: React.FC<{t: number}> = ({t}) => {
  const t0 = tl.end.dh;
  return (
    <AbsoluteFill style={{background: P.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <DhMark cell={48} n={cells(t, t0, 21, 0.05)} />
      <div style={{textAlign: 'center', opacity: on(t, t0 + 1.2) ? 1 : 0}}>
        <div style={{fontFamily: '"Hoop", sans-serif', fontWeight: 700, fontSize: 56, lineHeight: '64px', color: P.ink}}>David Hatley</div>
        <div style={{fontFamily: '"IBM Plex Mono", monospace', fontSize: 28, lineHeight: '36px', letterSpacing: '0.04em', color: P.muted, marginTop: 12}}>design · AI/ML · generative tools</div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 48}}>
          <Glyph rows={CHIP} cell={6} />
          <span style={{fontFamily: '"IBM Plex Mono", monospace', fontSize: 28, lineHeight: '36px', color: P.ink}}>github.com/davidghatley/3060-recipes</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- composition ----------

const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['bench', Bench], ['flags', Flags], ['ctx', Ctx], ['cache', Cache], ['run', Run]];
const Launch: React.FC<{x: Variant; theme?: Theme}> = ({x, theme = 'light'}) => {
  setTheme(theme);
  useFonts3();
  const t = useCurrentFrame() / FPS;
  if (t >= tl.end.dh) return <DhCard t={t} />;
  const idx = SCENES.reduce((acc, [k], i) => (t >= tl[k].in ? i : acc), 0);
  const Scene = SCENES[idx][1];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Chrome t={t} si={idx} t0={idx === 0 ? -1 : tl[SCENES[idx][0]].in} />
      <Scene t={t} x={x} />
    </AbsoluteFill>
  );
};
export const FlintLedger: React.FC = () => <Launch x="A" theme="light" />;
export const FlintPoster: React.FC = () => <Launch x="B" />;
export const FlintPosterDark: React.FC = () => <Launch x="B" theme="dark" />;
