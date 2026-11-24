import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import {
  Arr, CHIP, CREDITS, D, Glyph, HOP, HW1, HW2, Hop, Lab, MEM, MODEL, MONO, Mark, NAMES, P, PF, PI, Px, S, STATUS, TBD, Tick, type Theme, TypeOn,
  URL, carry, cells, count, fmt, has, mono, on, rise, setTheme, show, useFonts, useV, xfmt,
} from './kit';

// Qwen3.8-27B family on a 3060, in the Inkling / Flint v3 poster family.
//   01 stock vs tuned · 02 what stays in RAM · 03 the flags · 04 four finetunes · 05 the window (and MTP) · 06 run it · dh card.
// Every number comes from data.json (tools/prep.py checks each against ../runs/ledger.jsonl). Nulls print as a dash.

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
export type SceneP = {t: number};
const DEF = PF.default, FAST = PF.fast, LONG = PF.long;
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
const CHAPTERS: [string, string][] = [['hook', 'STOCK VS TUNED'], ['lever', 'WHAT STAYS IN RAM'], ['flags', 'THE FLAGS'], ['family', 'FOUR FINETUNES'], ['window', 'THE WINDOW'], ['run', 'RUN IT']];
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

/** 64 layers as cells. `whole` leading layers sit in RAM; `ffn` leading layers keep only their FFN in RAM (lower part of the cell). */
export const LayerRow: React.FC<{whole: number; ffn: number; cw: number; ch: number; gap: number; n?: number}> = ({whole, ffn, cw, ch, gap, n = 64}) => (
  <div style={{display: 'flex', gap}}>
    {Array.from({length: n}, (_, i) => {
      const ram = i < whole, half = !ram && i < ffn;
      return (
        <div key={i} style={{width: cw, height: ch, position: 'relative', background: ram ? P.muted : P.cobalt}}>
          {half && <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(ch * 0.6), background: P.muted}} />}
        </div>
      );
    })}
  </div>
);
export const Key: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div style={{display: 'flex', gap: 40, alignItems: 'center', ...style}}>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: P.cobalt}} /><Tick color={P.muted}>GPU</Tick></div>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: P.muted}} /><Tick color={P.muted}>RAM</Tick></div>
    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
      <div style={{width: 24, height: 24, position: 'relative', background: P.cobalt}}><div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, background: P.muted}} /></div>
      <Tick color={P.muted}>FFN in RAM</Tick>
    </div>
  </div>
);

/** One family member: name, stock -> tuned, a bar on a shared scale, the multiplier. */
export const famMax = Math.max(...MEM.map((m: any) => m.tuned ?? 0));
export const Bar: React.FC<{stock: number | null; tuned: number | null; k: number; h: number}> = ({stock, tuned, k, h}) => {
  const s = has(stock) ? (stock as number) / famMax : 0, z = has(tuned) ? (tuned as number) / famMax : 0;
  return (
    <div style={{position: 'relative', height: h, width: '100%'}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(s + (z - s) * k) * 100}%`, background: P.cobalt}} />
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${s * 100}%`, background: P.muted}} />
    </div>
  );
};

// ---------- 01 · stock vs tuned ----------
const Hook: React.FC<SceneP> = ({t}) => {
  const h = tl.hook;
  const v = useV();
  const big = S.x240;
  return (
    <Body>
      <div style={rise(t, h.head)}>
        <Lab color={P.cobaltText}>{v ? `PI-ADAPTED · ${PI.quant} · 32K CTX` : `PI-ADAPTED FINETUNE · ${PI.quant} ${fmt(PI.file_gb, 1)} GB · 32K CTX · STOCK LLAMA.CPP`}</Lab>
        <Hop size={S.l} style={{marginTop: 24}}>{v ? `${MODEL}\non a 12 GB\nRTX 3060` : `${MODEL} on a 12 GB RTX 3060`}</Hop>
      </div>
      <div style={{borderTop: `4px solid ${P.ink}`, marginTop: v ? 48 : 40, paddingTop: 24, ...show(t, h.nums)}}>
        <Lab>DECODE · TOK/S · STOCK FLAGS → TUNED</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: v ? 40 : 56, marginTop: 32, flexWrap: v ? 'wrap' : 'nowrap', rowGap: 32}}>
          <Px size={big} color={P.muted}>{fmt(PI.stock.decode, 1)}</Px>
          <Arr size={big} t={t} t0={h.nums + 0.15} />
          {v && <div style={{flexBasis: '100%', height: 0}} />}
          <Px size={big} style={show(t, h.nums + 0.35)}>{count(DEF.decode, t, h.nums + 0.35, 1, PI.stock.decode ?? 0)}</Px>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'flex-end', gap: v ? 40 : 96, marginTop: v ? 48 : 40}}>
        <Px size={S.x240} color={P.vermilion} style={show(t, h.delta)}>{xfmt(PI.speedup)}</Px>
        <div style={{borderTop: `2px solid ${P.rule}`, paddingTop: 20, paddingBottom: v ? 0 : 24, ...show(t, h.fast)}}>
          <Lab>16K WINDOW · ALL ON THE GPU</Lab>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 20}}>
            <Px size={S.xl}>{fmt(FAST.decode, 1)}</Px>
            <Px size={S.l} color={P.cobaltText} style={{marginTop: 24}}>{xfmt(PI.speedup_fast)}</Px>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 02 · what stays in RAM ----------
const Lever: React.FC<SceneP> = ({t}) => {
  const l = tl.lever;
  const v = useV();
  const stockN = PI.stock.layers_in_ram as number;
  const ffnN = DEF.ffn_in_ram as number;
  // the tuned row starts as stock and hands its layers back to the GPU one cell at a time
  const back = cells(t, l.move, stockN, 0.05);
  const moving = on(t, l.move) ? Math.max(0, stockN - back) : stockN;
  const cw = v ? 12 : 18, gap = v ? 3 : 5, ch = v ? 160 : 112;
  const row = (label: string, sub: string, whole: number, ffn: number, val: React.ReactNode, t0: number, muted: boolean) => (
    <div style={{borderTop: `2px solid ${P.ink}`, paddingTop: 20, marginTop: v ? 48 : 32, ...show(t, t0)}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: v ? 'flex-start' : 'baseline'}}>
        <Lab color={muted ? P.muted : P.ink}>{label}</Lab>
        {v ? val : <Lab>{sub}</Lab>}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 40, marginTop: 20}}>
        <LayerRow whole={whole} ffn={ffn} cw={cw} ch={ch} gap={gap} />
        {!v && <div style={{marginLeft: 'auto'}}>{val}</div>}
      </div>
      {v && <Lab style={{marginTop: 20}}>{sub}</Lab>}
    </div>
  );
  const tunedVal = moving > 0 ? count(DEF.decode, t, l.move, 1, PI.stock.decode, stockN * 0.05) : fmt(DEF.decode, 1);
  return (
    <Body>
      <Hop size={S.l} style={rise(t, l.title)}>{v ? '64 layers, 12 GB.\nWhat stays in RAM?' : '64 layers, 12 GB. What stays in RAM?'}</Hop>
      {row('STOCK · --FIT ON · F16 K/V', `${stockN} WHOLE LAYERS IN RAM`, stockN, 0, <Px size={S.l} color={P.muted}>{fmt(PI.stock.decode, 1)}</Px>, l.rows, true)}
      {row('TUNED · Q4_0 K/V · UB 256', `FFN OF LAYERS 0–${ffnN - 1} IN RAM · ${fmt(DEF.ram_gb, 2)} GB`, moving, ffnN, <Px size={S.l}>{tunedVal}</Px>, l.rows + 0.3, false)}
      <Key style={{marginTop: 32, ...show(t, l.rows)}} />
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 32, marginTop: v ? 48 : 40, borderTop: `4px solid ${P.ink}`, paddingTop: 24, flexWrap: 'wrap', ...show(t, l.cost)}}>
        <Px size={S.xl} color={P.vermilion}>{`~${D.ram_cost_ms_per_gb} ms`}</Px>
        <Lab style={{marginBottom: 12}}>PER TOKEN FOR EVERY GB LEFT IN RAM</Lab>
      </div>
    </Body>
  );
};

// ---------- 03 · the flags ----------
export const FlagRows: React.FC<{t: number; t0: number; size: number; note: number; stack: boolean; pad?: number}> = ({t, t0, size, note, stack, pad = 24}) => (
  <div style={{borderTop: `4px solid ${P.ink}`}}>
    {(D.flags as any[]).map((r, i) => {
      const ti = t0 + i * 0.35;
      return (
        <div key={i} style={{display: 'grid', gridTemplateColumns: stack ? '1fr' : '1fr max-content', columnGap: 40, rowGap: 12, alignItems: 'center', padding: `${pad}px 0`, borderBottom: `2px solid ${P.faint}`}}>
          <div style={mono(size, P.cobaltText, 600)}><TypeOn text={r.flag} t={t} t0={ti} rate={0.012} /></div>
          <Px size={note} style={{justifySelf: stack ? 'start' : 'end', ...show(t, ti + 0.25)}}>{r.note ?? TBD}</Px>
        </div>
      );
    })}
  </div>
);
const Flags: React.FC<SceneP> = ({t}) => {
  const f = tl.flags;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, f.in)}>{v ? 'Four changes to\nstock llama.cpp' : 'Four changes to stock llama.cpp'}</Hop>
      <div style={{marginTop: v ? 40 : 40}}><FlagRows t={t} t0={f.rows} size={v ? 32 : 48} note={v ? S.m : S.m} stack={v} pad={v ? 56 : 28} /></div>
      {v ? <div style={show(t, f.rows + 1.6)}><Lab style={{marginTop: 40}}>SAME FLAGS FOR ALL FOUR FINETUNES;</Lab><Lab style={{marginTop: 8}}>ONLY THE FFN COUNT CHANGES</Lab></div>
         : <Lab style={{marginTop: 32, ...show(t, f.rows + 1.6)}}>SAME FLAGS FOR ALL FOUR FINETUNES; ONLY THE FFN COUNT CHANGES</Lab>}
    </Body>
  );
};

// ---------- 04 · four finetunes ----------
export const FamilyRows: React.FC<{t: number; t0: number; v: boolean; num: number; barH: number; gapY: number; nameW?: number; noBy?: boolean}> = ({t, t0, v, num, barH, gapY, nameW = 440, noBy}) => (
  <div style={{borderTop: `4px solid ${P.ink}`}}>
    {MEM.map((m: any, i: number) => {
      const ti = t0 + i * 0.3;
      const k = carry(t, ti + 0.2, 0.7);
      const nums = (
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 20}}>
          <Px size={num} color={P.muted}>{fmt(m.stock, 1)}</Px>
          <Arr size={num} t={t} t0={ti + 0.1} />
          <Px size={num}>{count(m.tuned, t, ti + 0.2, 1, m.stock ?? 0, 0.7)}</Px>
        </div>
      );
      const name = (
        <div>
          <Tick>{NAMES[m.id]}</Tick>
          {!noBy && <Lab style={{marginTop: 12}}>{m.by.toUpperCase()}</Lab>}
        </div>
      );
      return (
        <div key={m.id} style={{padding: `${gapY}px 0`, borderBottom: `2px solid ${P.faint}`, ...show(t, ti)}}>
          {v ? (
            <>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>{name}<Px size={num} color={P.cobaltText} style={show(t, ti + 0.9)}>{xfmt(m.speedup)}</Px></div>
              <div style={{marginTop: 20}}>{nums}</div>
              <div style={{marginTop: 20}}><Bar stock={m.stock} tuned={m.tuned} k={k} h={barH} /></div>
            </>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: `${nameW}px ${num * 6}px 1fr max-content`, columnGap: 48, alignItems: 'center'}}>
              {name}
              {nums}
              <Bar stock={m.stock} tuned={m.tuned} k={k} h={barH} />
              <Px size={num} color={P.cobaltText} style={{minWidth: num * 2.2, textAlign: 'right', ...show(t, ti + 0.9)}}>{xfmt(m.speedup)}</Px>
            </div>
          )}
        </div>
      );
    })}
  </div>
);
const Family: React.FC<SceneP> = ({t}) => {
  const f = tl.family;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, f.in)}>{v ? 'One config,\nfour finetunes' : 'One config, four finetunes'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, f.in + 0.2)}}>{v ? 'DECODE TOK/S · 32K · STOCK → TUNED' : 'DECODE TOK/S AT 32K · STOCK FLAGS → TUNED, SAME FLAGS FOR ALL FOUR'}</Lab>
      <div style={{marginTop: 32}}><FamilyRows t={t} t0={f.rows} v={v} num={S.l} barH={v ? 40 : 40} gapY={v ? 40 : 28} /></div>
    </Body>
  );
};

// ---------- 05 · the window ----------
export const WindowCols: React.FC<{t: number; t0: number; v: boolean; big: number; compact?: boolean}> = ({t, t0, v, big, compact}) => {
  const cols: [any, string][] = [[FAST, 'ALL ON GPU'], [DEF, `FFN 0–${DEF.ffn_in_ram - 1} IN RAM`], [LONG, `FFN 0–${LONG.ffn_in_ram - 1} IN RAM`]];
  if (compact) return (
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 32}}>
      {cols.map(([p], i) => (
        <div key={i} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 16}}>
          <Lab color={P.ink}>{`${ctxK(p.ctx)} CTX`}</Lab>
          <Px size={big} style={{marginTop: 16}}>{fmt(p.decode, 1)}</Px>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '1fr 1fr 1fr', columnGap: 48, rowGap: 32}}>
      {cols.map(([p, place], i) => (
        <div key={i} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, t0 + i * 0.3)}}>
          {v ? <Lab color={P.ink}>{`${ctxK(p.ctx)} WINDOW · ${place}`}</Lab> : <><Lab color={P.ink}>{`${ctxK(p.ctx)} WINDOW`}</Lab><Lab style={{marginTop: 8}}>{place}</Lab></>}
          {v ? (
            <div style={{display: 'flex', alignItems: 'flex-end', gap: 32, marginTop: 16}}>
              <Px size={big}>{fmt(p.decode, 1)}</Px>
              <div style={{paddingBottom: 8}}>
                <Lab>{`${fmt(p.decode_deep, 1)} AT ${String(p.deep_at).toUpperCase()}`}</Lab>
                <Lab style={{marginTop: 8}}>{`NEEDLES ${p.needles.map((x: string) => x.split(' ')[1]).join(', ')}`}</Lab>
              </div>
            </div>
          ) : (
            <>
              <Px size={big} style={{marginTop: 24}}>{fmt(p.decode, 1)}</Px>
              <Lab style={{marginTop: 24}}>{`${fmt(p.decode_deep, 1)} AT ${String(p.deep_at).toUpperCase()} DEEP`}</Lab>
              <Lab style={{marginTop: 8}}>{`NEEDLES ${p.needles.map((x: string) => x.split(' ')[1]).join(', ')}`}</Lab>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
export const MtpLine: React.FC<{t: number; t0: number; v: boolean; stamp?: number}> = ({t, t0, v, stamp = S.m}) => {
  const m = D.mtp;
  return (
    <div style={{borderTop: `2px solid ${P.ink}`, paddingTop: 24, display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: v ? 'flex-start' : 'center', gap: v ? 20 : 40, ...show(t, t0)}}>
      <div style={{background: P.vermilion, padding: `${stamp / 6}px ${stamp / 3}px`}}><Px size={stamp} color={P.ink}>MTP: NOT KEPT</Px></div>
      <div>
        {v ? (
          <>
            <Lab color={P.ink}>{`DRAFTS ${m.accept} ACCEPTED,`}</Lab>
            <Lab color={P.ink} style={{marginTop: 8}}>{`NEEDS ~${m.vram_mib} MIB OF VRAM`}</Lab>
            <Lab style={{marginTop: 16}}>{`${fmt(m.decode, 2)} VS ${m.controls.map((x: number) => fmt(x, 2)).join(' / ')}`}</Lab>
            <Lab style={{marginTop: 8}}>TOK/S WITHOUT IT</Lab>
          </>
        ) : (
          <>
            <Lab color={P.ink}>{`DRAFTS ${m.accept} ACCEPTED, NEEDS ~${m.vram_mib} MIB`}</Lab>
            <Lab style={{marginTop: 8}}>{`${fmt(m.decode, 2)} VS ${m.controls.map((x: number) => fmt(x, 2)).join(' / ')} TOK/S WITHOUT IT`}</Lab>
          </>
        )}
      </div>
    </div>
  );
};
const Window: React.FC<SceneP> = ({t}) => {
  const w = tl.window;
  const v = useV();
  return (
    <Body>
      <Hop size={S.l} style={rise(t, w.in)}>{v ? 'Pick a window:\n16k, 32k or 128k' : 'Pick a window: 16k, 32k or 128k'}</Hop>
      <Lab style={{marginTop: 20, ...show(t, w.in + 0.2)}}>{v ? 'PI-ADAPTED · DECODE TOK/S' : 'PI-ADAPTED · DECODE TOK/S, EMPTY AND DEEP'}</Lab>
      <div style={{marginTop: 40}}><WindowCols t={t} t0={w.cols} v={v} big={S.xl} /></div>
      <div style={{marginTop: v ? 48 : 56}}><MtpLine t={t} t0={w.mtp} v={v} /></div>
    </Body>
  );
};

// ---------- 06 · run it ----------
const CMD: [string, string][] = [
  ['./serve.sh', 'pi, 32k'],
  ['VARIANT=huihui ./serve.sh', 'fastest member'],
  ['Q38_PROFILE=fast ./serve.sh', '16k, all on GPU'],
  ['Q38_PROFILE=long ./serve.sh', '128k'],
];
const Run: React.FC<SceneP> = ({t}) => {
  const r = tl.run;
  const v = useV();
  const k = carry(t, r.cmd, 0.5);
  const sz = v ? 32 : 48;
  const box = (
    <div style={{background: P.sheet, outline: `2px solid ${P.ink}`, padding: v ? '20px 24px' : '24px 32px', clipPath: k >= 1 ? 'none' : `inset(-4px ${(1 - k) * 100}% -4px -4px)`}}>
      {CMD.map(([c, note], i) => (
        <div key={i} style={{display: 'flex', flexDirection: v ? 'column' : 'row', gap: v ? 0 : 0, marginBottom: v && i < CMD.length - 1 ? 12 : 0}}>
          <div style={{...mono(sz), width: v ? undefined : 860}}><TypeOn text={c} t={t} t0={r.cmd + 0.2 + i * 0.15} rate={0.008} /></div>
          <div style={{...mono(sz, P.muted), ...show(t, r.cmd + 0.5 + i * 0.15)}}>{`# ${note}`}</div>
        </div>
      ))}
    </div>
  );
  return (
    <Body>
      <Px size={S.l} color={P.cobaltText} style={{whiteSpace: 'pre', lineHeight: '88px', ...show(t, r.cmd + 0.6)}}>{v ? 'github.com/\ndavidghatley/\n3060-recipes' : URL}</Px>
      <div style={{marginTop: v ? 32 : 32}}>{box}</div>
      <div style={{marginTop: v ? 40 : 40, borderTop: `2px solid ${P.ink}`}}>
        {CREDITS.map(([key, val], i) => (
          <div key={key} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '460px 1fr', rowGap: 8, padding: v ? '24px 0' : '12px 0', borderBottom: `2px solid ${P.faint}`, ...show(t, r.credits + i * 0.15)}}>
            <Lab>{key}</Lab>
            <Lab color={P.ink}>{val}</Lab>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- the dh card (same close as the Flint and Inkling videos; the name in Hopscotch) ----------
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
const SCENES: [string, React.FC<SceneP>][] = [['hook', Hook], ['lever', Lever], ['flags', Flags], ['family', Family], ['window', Window], ['run', Run]];
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
export const QwenLight: React.FC = () => <Launch theme="light" />;
export const QwenDark: React.FC = () => <Launch theme="dark" />;
