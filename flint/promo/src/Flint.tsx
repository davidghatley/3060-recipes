import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import tlJson from './timeline.json';
import dataJson from './data.json';
import {CHIP, Count, F, Glyph, Mark, P, TypeOn, arrive, carry, label, on, useHouseFonts} from './house';

// Flint on one RTX 3060: launch clip for people who already run local models. Numbers first, few words.
// One component tree, two shapes: 1920x1080 and 1080x1920 (portrait keeps the bottom 320 px clear of X's UI).
// Type is one house step up from the docs scale everywhere: labels 32, data 32/48, headlines 72, numerals 120.
// Times from timeline.json; every number from data.json (tools/prep.py, from ../runs).

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
const D = dataJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
const M = 48;

export const useV = () => {
  const {width, height} = useVideoConfig();
  return height > width;
};
const fmt = (n: number, dp = 0) => n.toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp});
export const HW = `RTX 3060 12 GB · I5-12500 · 62 GB DDR5 · LLAMA.CPP ${String(D.engine.build).toUpperCase()}`;
export const MODEL = `Flint 40B-A${D.model.active_b}B`;
/** Tick 35 label one step up (32 px). */
export const LAB: React.CSSProperties = {...label, fontSize: 32, lineHeight: '40px', letterSpacing: '3px'};

// ---------- chrome ----------

const CHAPTERS: [string, string][] = [['hook', 'FLINT ON A 3060'], ['bench', 'STOCK VS TUNED'], ['flags', 'THE FLAGS'], ['ctx', 'LONG CONTEXT'], ['run', 'RUN IT']];
const Chrome: React.FC<{t: number; si: number}> = ({t, si}) => {
  const v = useV();
  return (
    <>
      <div style={{position: 'absolute', left: M, top: 36, display: 'flex', alignItems: 'center', gap: 16}}>
        <Glyph rows={CHIP} cell={6} />
        <span style={LAB}><TypeOn text={`PLATE 0${si + 1} · ${CHAPTERS[si][1]}`} t={t} t0={si === 0 ? -1 : tl[CHAPTERS[si][0]].in} /></span>
      </div>
      <div style={{position: 'absolute', right: M, top: 44, display: 'flex', gap: 6}}>
        {CHAPTERS.map((_, i) => <div key={i} style={{width: 20, height: 20, boxSizing: 'border-box', background: i <= si ? P.cobalt : 'transparent', border: i <= si ? 'none' : `2px solid ${P.rule}`}} />)}
      </div>
      <div style={{position: 'absolute', left: M, right: M, top: 96, height: 2, background: P.rule}} />
      <div style={{position: 'absolute', left: M, right: M, bottom: v ? 320 : 36, borderTop: `2px solid ${P.rule}`, paddingTop: 12}}>
        <span style={{...label, fontSize: v ? 25 : 32, lineHeight: v ? '32px' : '40px', letterSpacing: v ? '2px' : '3px'}}>{HW}</span>
      </div>
    </>
  );
};

/** The content column between the chrome rules. */
const Body: React.FC<{children: React.ReactNode; gap?: number}> = ({children, gap = 48}) => {
  const v = useV();
  return <div style={{position: 'absolute', left: M, right: M, top: v ? 152 : 136, bottom: v ? 400 : 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap}}>{children}</div>;
};
const H: React.FC<{t: number; t0: number; children: React.ReactNode; size?: number}> = ({t, t0, children, size = 72}) => (
  <div style={{fontFamily: F.text, fontWeight: 700, fontSize: size, lineHeight: `${size + 8}px`, color: P.ink, textWrap: 'balance', opacity: arrive(t, t0, 0.4), transform: `translateY(${(1 - arrive(t, t0, 0.4)) * 16}px)`} as React.CSSProperties}>{children}</div>
);
const L: React.FC<{children: React.ReactNode; color?: string; style?: React.CSSProperties}> = ({children, color = P.muted, style}) => <div style={{...LAB, color, ...style}}>{children}</div>;
/** Everything under the headline; Body centres headline and content together. */
const Fill: React.FC<{children: React.ReactNode; gap?: number}> = ({children, gap = 48}) => <div style={{display: 'flex', flexDirection: 'column', gap}}>{children}</div>;
const show = (t: number, t0: number): React.CSSProperties => ({opacity: on(t, t0) ? 1 : 0});

// ---------- 01 · hook: old → new, same size ----------

// A right arrow on Stem 7's grid (one cell = 120/8 = 15 px, 1-cell strokes, 7 cells tall like the caps).
const ARROW = ['...X...', '....X..', '.....X.', 'XXXXXXX', '.....X.', '....X..', '...X...'];
const Arrow: React.FC<{n?: number}> = ({n = 99}) => {
  const cell = 15;
  const pts = ARROW.flatMap((r, y) => [...r].map((ch, x) => (ch === 'X' ? [x, y] : null)).filter(Boolean)) as number[][];
  pts.sort((a, b) => a[0] - b[0]);
  return <svg width={cell * 7} height={cell * 7} shapeRendering="crispEdges" style={{flex: 'none'}}>{pts.slice(0, n).map(([x, y]) => <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={P.cobalt} />)}</svg>;
};
const Jump: React.FC<{t: number; t0: number; tag: string; from: number; to: number; delta: string; focal?: boolean; note?: string}> = ({t, t0, tag, from, to, delta, focal, note}) => (
  <div style={{borderTop: `4px solid ${P.ink}`, paddingTop: 20, minWidth: 0, ...show(t, t0)}}>
    <L>{tag}</L>
    <div style={{display: 'flex', alignItems: 'center', gap: 36, marginTop: 16, height: 120}}>
      <span style={{fontFamily: F.px, fontSize: 120, lineHeight: '120px', color: P.muted}}>{fmt(from)}</span>
      <Arrow n={Math.floor(Math.max(0, t - t0 - 0.2) / 0.03)} />
      <span style={{fontFamily: F.px, fontSize: 120, lineHeight: '120px', color: P.ink, ...show(t, t0 + 0.4)}}><Count to={to} from={from} t={t} t0={t0 + 0.4} dur={0.6} /></span>
    </div>
    <div style={{display: 'flex', alignItems: 'baseline', gap: 32, marginTop: 16, flexWrap: 'wrap', opacity: on(t, tl.hook.delta) ? 1 : 0}}>
      <span style={{fontFamily: F.mono, fontWeight: 600, fontSize: 48, lineHeight: '64px', color: focal ? P.vermilion : P.cobalt}}>{delta}</span>
      {note && <span style={{fontFamily: F.mono, fontSize: 32, lineHeight: '48px', color: P.muted}}>{note}</span>}
    </div>
  </div>
);
const Hook: React.FC<{t: number}> = ({t}) => {
  const h = tl.hook;
  const v = useV();
  return (
    <Body gap={v ? 56 : 40}>
      <div>
        <L color={P.cobalt} style={show(t, h.head)}>LLAMA.CPP RECIPE · Q4_K_M · 128K CTX</L>
        <div style={{marginTop: 12}}><H t={t} t0={h.head}>{MODEL} on a 12 GB RTX 3060</H></div>
      </div>
      <Fill gap={v ? 80 : 40}>
        <Jump t={t} t0={h.pp} tag="PREFILL · TOK/S · 11K PROMPT" from={D.ttft.old_tps} to={D.ttft.new_tps} delta={`${(D.ttft.new_tps / D.ttft.old_tps).toFixed(1)}×`} focal />
        <Jump t={t} t0={h.tg} tag="DECODE · TOK/S" from={Math.round(D.decode.old_prose)} to={Math.round(D.decode.new_prose)} delta={`+${Math.round((D.decode.new_prose / D.decode.old_prose - 1) * 100)}%`} note={`${D.kv.q8_32k.toFixed(1)} → ${D.kv.f16_32k} @ 32k depth`} />
      </Fill>
    </Body>
  );
};

// ---------- 02 · bench: stock flags vs tuned, row by row ----------

const Swatch: React.FC<{c: string}> = ({c}) => <span style={{display: 'inline-block', width: 24, height: 24, background: c, marginRight: 12, verticalAlign: '-2px'}} />;
const Bench: React.FC<{t: number}> = ({t}) => {
  const b = tl.bench;
  const v = useV();
  const last = D.prefill_steps[D.prefill_steps.length - 1].tps;
  const rows: [string, number, number, string, number][] = [
    ['TTFT 11k', D.ttft.old_s, D.ttft.new_s, 's', 1],
    ['pp 11k', D.ttft.old_tps, D.ttft.new_tps, 'tok/s', 0],
    ['pp4096', D.prefill_steps[0].tps, last, 'tok/s', 0],
    ['tg', D.decode.old_prose, D.decode.new_prose, 'tok/s', 1],
    ['tg @ 32k', D.kv.q8_32k, D.kv.f16_32k, 'tok/s', 1],
  ];
  const barW = v ? 640 : 1100;
  return (
    <Body gap={v ? 40 : 24}>
      <H t={t} t0={b.in}>Stock flags vs tuned</H>
      <Fill gap={v ? 40 : 28}>
        <div style={{display: 'flex', gap: 40}}>
          <L><Swatch c={P.rule} />STOCK</L>
          <L color={P.ink}><Swatch c={P.cobalt} />TUNED</L>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '340px 1fr', rowGap: v ? 12 : 24, columnGap: 32, alignItems: 'center'}}>
          {rows.map(([name, a, z, unit, dp], i) => {
            const t0 = b.rows + i * 0.25;
            const max = Math.max(a, z);
            const k = carry(t, t0, 0.5);
            const bar = (val: number, hot: boolean) => (
              <div style={{display: 'flex', alignItems: 'center', gap: 16, height: 44}}>
                <div style={{width: (val / max) * barW * k, height: 40, background: hot ? P.cobalt : P.rule}} />
                <span style={{fontFamily: F.mono, fontWeight: hot ? 600 : 400, fontSize: 32, lineHeight: '40px', color: hot ? P.ink : P.muted, whiteSpace: 'pre', ...show(t, t0 + 0.3)}}>{`${fmt(val, dp)} ${unit}`}</span>
              </div>
            );
            return (
              <React.Fragment key={name}>
                <div style={{fontFamily: F.mono, fontWeight: 600, fontSize: 48, lineHeight: '64px', color: P.ink, marginTop: v && i ? 24 : 0, ...show(t, t0)}}>{name}</div>
                <div style={{display: 'grid', gap: 4}}>{bar(a, false)}{bar(z, true)}</div>
              </React.Fragment>
            );
          })}
        </div>
      </Fill>
    </Body>
  );
};

// ---------- 03 · flags: the diff and what each bought ----------

const Flags: React.FC<{t: number}> = ({t}) => {
  const f = tl.flags;
  const v = useV();
  const rows: [string, string][] = [
    ['-b 4096 -ub 4096', 'pp 4.1×'],
    ['--load-mode none', 'pp +24%'],
    ['-ctk f16 -ctv f16', 'tg @ 32k +29%'],
    ['-ncmoe 43', 'tg +4%'],
    ['--spec-type ngram-map-k', `tg up to ${Math.round(D.decode.spec_best)} on code`],
  ];
  return (
    <Body gap={v ? 48 : 32}>
      <H t={t} t0={f.in}>Five flags. No patches.</H>
      <Fill><div style={{borderTop: `2px solid ${P.ink}`}}>
        {rows.map(([flag, gain], i) => {
          const t0 = f.rows + i * 0.3;
          return (
            <div key={flag} style={{display: 'grid', gridTemplateColumns: v ? '1fr' : '860px 1fr', padding: v ? '24px 0' : '16px 0', borderBottom: `2px solid ${P.faint}`, fontFamily: F.mono, fontSize: 48, lineHeight: '64px', whiteSpace: 'pre'}}>
              <div style={{fontWeight: 600, color: P.cobalt}}><TypeOn text={flag} t={t} t0={t0} rate={0.012} /></div>
              <div style={{color: P.ink, ...show(t, t0 + 0.25)}}>{gain}</div>
            </div>
          );
        })}
      </div></Fill>
    </Body>
  );
};

// ---------- 04 · long context ----------

const Ctx: React.FC<{t: number}> = ({t}) => {
  const c = tl.ctx;
  const v = useV();
  const stats: [string, string, string][] = [
    ['NIAH @ 120K', `${D.needles.k120}`, `also ${D.needles.k60} @ 60k`],
    ['PP @ 120K', fmt(D.needles.prefill_120k), 'tok/s'],
    ['VRAM', (D.needles.vram_mib / 1024).toFixed(1), 'GiB of 12'],
  ];
  return (
    <Body gap={48}>
      <H t={t} t0={c.in}>128k context in 12 GB</H>
      <Fill><div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : 'repeat(3, 1fr)', gap: v ? 56 : 48}}>
        {stats.map(([k, val, sub], i) => (
          <div key={k} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, c.stats + i * 0.3)}}>
            <L>{k}</L>
            <div style={{fontFamily: F.px, fontSize: 120, lineHeight: '152px', color: P.ink}}>{val}</div>
            <div style={{fontFamily: F.mono, fontSize: 48, lineHeight: '64px', color: P.muted}}>{sub}</div>
          </div>
        ))}
      </div></Fill>
    </Body>
  );
};

// ---------- 05 · run it ----------

const Run: React.FC<{t: number}> = ({t}) => {
  const r = tl.run;
  const v = useV();
  const cmd = v
    ? ['llama-server \\', '  -m Flint-Q4_K_M.gguf \\', '  -ngl 99 -ncmoe 43 \\', '  --fit off -c 131072 \\', '  -t 6 -b 4096 -ub 4096 \\', '  --load-mode none \\', '  -fa on -ctk f16 -ctv f16 \\', '  --jinja \\', '  --spec-type ngram-map-k']
    : ['llama-server -m Flint-Q4_K_M.gguf -ngl 99 -ncmoe 43 \\', '  --fit off -c 131072 -t 6 -b 4096 -ub 4096 \\', '  --load-mode none -fa on -ctk f16 -ctv f16 \\', '  --jinja --spec-type ngram-map-k'];
  const credits: [string, string][] = [['MODEL', 'Flint · Recursive'], ['ENGINE', 'llama.cpp · ggml-org'], ['METHOD', 'inference-optimisation · 0xSero']];
  const k = carry(t, r.cmd, 0.5);
  return (
    <Body gap={v ? 40 : 32}>
      <div style={{background: P.sheet, outline: `2px solid ${P.ink}`, padding: '20px 32px', clipPath: k >= 1 ? 'none' : `inset(-4px ${(1 - k) * 100}% -4px -4px)`}}>
        {cmd.map((l, i) => <div key={i} style={{fontFamily: F.mono, fontSize: 48, lineHeight: '64px', color: P.ink, whiteSpace: 'pre'}}><TypeOn text={l} t={t} t0={r.cmd + 0.2 + i * 0.15} rate={0.006} /></div>)}
      </div>
      <div style={{fontFamily: F.mono, fontWeight: 600, fontSize: 48, lineHeight: '64px', color: P.cobalt, whiteSpace: 'pre', ...show(t, r.cmd + 0.8)}}>{v ? 'github.com/davidghatley/\n3060-recipes' : 'github.com/davidghatley/3060-recipes'}</div>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr' : 'repeat(3, 1fr)', gap: v ? 24 : 48}}>
        {credits.map(([key, val], i) => (
          <div key={key} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 12, ...show(t, r.credits + i * 0.2)}}>
            <L>{key}</L>
            <div style={{fontFamily: F.text, fontWeight: 700, fontSize: 32, lineHeight: '40px', color: P.ink}}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 20, alignSelf: v ? 'flex-start' : 'flex-end', opacity: arrive(t, r.credits + 0.8)}}>
        <Mark cell={8} />
        <div>
          <div style={{fontFamily: F.text, fontWeight: 700, fontSize: 32, lineHeight: '40px', color: P.ink}}>David Hatley</div>
          <div style={{fontFamily: F.text, fontSize: 25, lineHeight: '32px', color: P.muted}}>design · AI/ML · generative tools</div>
        </div>
      </div>
    </Body>
  );
};

// ---------- composition ----------

const SCENES: [string, React.FC<{t: number}>][] = [['hook', Hook], ['bench', Bench], ['flags', Flags], ['ctx', Ctx], ['run', Run]];
export const FlintLaunch: React.FC = () => {
  useHouseFonts();
  const t = useCurrentFrame() / FPS;
  const idx = SCENES.reduce((acc, [k], i) => (t >= tl[k].in ? i : acc), 0);
  const Scene = SCENES[idx][1];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Chrome t={t} si={idx} />
      <Scene t={t} />
    </AbsoluteFill>
  );
};
