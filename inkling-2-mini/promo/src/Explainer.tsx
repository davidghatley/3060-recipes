import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import exJson from './explainer.json';
import {
  Arr, CHIP, CREDITS, CellBar, D, Glyph, HOOP, HW1, LOOP_N, Lab, MONO, Mark, P, Px, R, S, type Theme, TypeOn,
  URL, carry, cells, fmt, has, on, rise, setTheme, show, useFonts,
} from './kit';
import {LoopFigure, loopEnd} from './Loop';

// Inkling-2-Mini explainer for designers and builders: one idea per plate, slow enough to read.
// Facts and scores from explainer.json (model card, Vals AI); run numbers from data.json, shown only once measured.

/* eslint-disable @typescript-eslint/no-explicit-any */
const X = exJson as any;
const T = X.t;
const F = X.facts;
export const EX_FPS: number = X.fps;
export const EX_FRAMES = Math.round(X.total * X.fps);
const M = D.model;
const MEASURED = has(R.tuned_tps);
// K scales every entry delay inside a plate (v2 pacing: 0.6 of v1).
const K: number = X.k ?? 1;
const FOOTNOTE = 'SCORES REPORTED BY THINKING MACHINES AND VALS AI · NOT OUR MEASUREMENTS';

// ---------- chrome ----------
const L = 48;
const PLATES: [string, string, string][] = [
  ['what', 'WHAT IT IS', 'MODEL CARD'], ['moe', 'MIXTURE OF EXPERTS', 'MODEL CARD'], ['loop', 'THE LOOP', 'MODEL CARD'],
  ['cyber', 'CYBERBENCH', 'VALS AI'], ['code', 'CODING', 'MODEL CARD'], ['docs', 'DOCUMENTS AND IMAGES', 'MODEL CARD'],
  ['fits', 'ON A 12 GB CARD', MEASURED ? 'MEASURED' : 'IN PROGRESS'], ['close', 'WHAT IS NEXT', 'COMING SOON'],
];
const Chrome: React.FC<{t: number; si: number; foot: string}> = ({t, si, foot}) => (
  <>
    <div style={{position: 'absolute', left: L, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
      <Glyph rows={CHIP} cell={6} color={P.cobalt} />
      <Lab><TypeOn text={`PLATE ${String(si + 1).padStart(2, '0')} · ${PLATES[si][1]} · ${PLATES[si][2]}`} t={t} t0={si === 0 ? -1 : T[PLATES[si][0]]} /></Lab>
    </div>
    <div style={{position: 'absolute', right: L, top: 38, display: 'flex', gap: 8}}>
      {PLATES.map((_, i) => <div key={i} style={{width: 20, height: 20, boxSizing: 'border-box', background: i <= si ? P.cobalt : 'transparent', border: i <= si ? 'none' : `2px solid ${P.rule}`}} />)}
    </div>
    <div style={{position: 'absolute', left: L, right: L, top: 96, height: 2, background: P.rule}} />
    <div style={{position: 'absolute', left: L, right: L, top: 1000, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}><Lab>{foot}</Lab></div>
  </>
);
const Body: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: L, right: L, top: 128, height: 848, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}><div>{children}</div></div>
);
const Title: React.FC<{t: number; t0: number; children: React.ReactNode}> = ({t, t0, children}) => (
  <Px size={S.l} style={{whiteSpace: 'pre-wrap', lineHeight: '88px', ...rise(t, t0 + K * 0.2)}}>{children}</Px>
);
const Stat: React.FC<{k: string; v: string; sub?: string; style?: React.CSSProperties; color?: string; size?: number}> = ({k, v, sub, style, color = P.ink, size = S.xl}) => (
  <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...style}}>
    <Lab>{k}</Lab>
    <Px size={size} color={color} style={{marginTop: 24}}>{v}</Px>
    {sub && <Lab style={{marginTop: 24}}>{sub}</Lab>}
  </div>
);

// ---------- 01 · what it is ----------
const What: React.FC<{t: number}> = ({t}) => (
  <Body>
    <div style={rise(t, 0.2)}>
      <Lab color={P.cobaltText}>{`THINKING MACHINES · RELEASED ${F.released}`}</Lab>
      <Px size={S.xl} style={{marginTop: 32}}>Inkling-2-Mini</Px>
      <Px size={S.m} color={P.muted} style={{marginTop: 32, whiteSpace: 'pre-wrap', lineHeight: '64px'}}>An open model that reads text and images.</Px>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 64, marginTop: 72}}>
      <Stat k="OPEN WEIGHTS" v={F.license} sub="USE IT, CHANGE IT, SHIP IT" style={show(t, K * 1.6)} size={S.l} />
      <Stat k="INPUT" v="Text + image" sub="SCREENSHOTS, PDFS, PHOTOS" style={show(t, K * 2.2)} size={S.l} />
      <Stat k="CONTEXT" v={`${M.ctx_max} tokens`} sub="ROUGHLY 1,500 PAGES OF TEXT" style={show(t, K * 2.8)} size={S.l} />
    </div>
  </Body>
);

// ---------- 02 · mixture of experts ----------
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0); };
const picks = (tok: number, n: number, of: number) => {
  const out = new Set<number>();
  for (let i = 0; out.size < n; i++) out.add(hash(tok + 1, i) % of);
  return out;
};
const Moe: React.FC<{t: number}> = ({t}) => {
  const t0 = T.moe;
  const n = F.experts, k = F.experts_per_token;
  const tok = Math.max(0, Math.floor((t - t0 - K * 2.2) / 0.8));
  const lit = t >= t0 + K * 2.2 ? picks(tok, k, n) : new Set<number>();
  const cell = 52, gap = 8, cols = 16;
  return (
    <Body>
      <Title t={t} t0={t0}>{'A big model that only\nwakes up a small part of itself'}</Title>
      <div style={{display: 'grid', gridTemplateColumns: `max-content 1fr`, columnGap: 96, marginTop: 56, alignItems: 'start'}}>
        <div style={show(t, t0 + K * 0.8)}>
          <Lab>{`${n} EXPERTS · ${k} PICKED FOR EACH TOKEN`}</Lab>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gap, marginTop: 24}}>
            {Array.from({length: n}, (_, i) => (
              <div key={i} style={{width: cell, height: cell, boxSizing: 'border-box', background: lit.has(i) ? P.cobalt : 'transparent', border: `2px solid ${lit.has(i) ? P.cobalt : P.rule}`, opacity: i < cells(t, t0 + K * 0.8, n, 0.006) ? 1 : 0}} />
            ))}
          </div>
          <Lab style={{marginTop: 24, ...show(t, t0 + K * 2.2)}}>{`TOKEN ${tok + 1}: A DIFFERENT ${k} EACH TIME`}</Lab>
        </div>
        <div>
          <div style={{borderTop: `4px solid ${P.ink}`, paddingTop: 20, ...show(t, t0 + K * 1.4)}}>
            <Lab>PARAMETERS IN TOTAL</Lab>
            <Px size={S.xl} color={P.muted} style={{marginTop: 24}}>{`${M.total_b}B`}</Px>
          </div>
          <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, marginTop: 48, ...show(t, t0 + K * 2.6)}}>
            <Lab color={P.cobaltText}>USED PER TOKEN</Lab>
            <Px size={S.xl} style={{marginTop: 24}}>{`${M.active_b}B`}</Px>
          </div>
        </div>
      </div>
    </Body>
  );
};

// ---------- 03 · the loop ----------
const Loop: React.FC<{t: number}> = ({t}) => {
  const t0 = T.loop;
  const tm = {go: t0 + K * 1.4, pre: 0.6, pass: 0.9, back: 0.4};
  const end = loopEnd(tm);
  return (
    <Body>
      <Title t={t} t0={t0}>{`The same ${LOOP_N} middle layers run ${M.loop_times} times`}</Title>
      <div style={{marginTop: 48, ...show(t, t0 + K * 0.8)}}>
        <LoopFigure t={t} tm={tm} cw={48} ch={136} gap={8} gg={56} big={S.xl} loopH={88} />
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', columnGap: 96, marginTop: 40}}>
        {[['LAYERS OF WEIGHTS', String(F.layers)], ['LAYER PASSES PER TOKEN', String(F.passes)], ['EFFECTIVE ACTIVE', `≈${F.effective_active_b}B`]].map(([k, v], i) => (
          <div key={k} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16, ...show(t, end + 0.2 + i * 0.3)}}>
            <Lab>{k}</Lab>
            <Px size={S.l} style={{marginTop: 16}}>{v}</Px>
          </div>
        ))}
      </div>
    </Body>
  );
};

// ---------- 04 · CyberBench ----------
const Cyber: React.FC<{t: number}> = ({t}) => {
  const t0 = T.cyber;
  const c = X.cyber;
  const k = carry(t, t0 + K * 1.4, 0.7);
  const bar = (label: string, v: number, fill: string, t1: number) => (
    <div style={{display: 'grid', gridTemplateColumns: '560px 1fr max-content', columnGap: 32, alignItems: 'center', ...show(t, t1)}}>
      <Px size={S.label} color={fill === P.cobalt ? P.ink : P.muted}>{label}</Px>
      <div style={{height: 48, width: `${(v / 100) * 100 * k}%`, background: fill}} />
      <Px size={S.l}>{`${v.toFixed(2)}%`}</Px>
    </div>
  );
  return (
    <Body>
      <Title t={t} t0={t0}>{`Ties ${c.opus_label.replace(' (CVP)', '')} on ${c.name}`}</Title>
      <Lab style={{marginTop: 16, ...rise(t, t0 + K * 0.4)}}>{`SECURITY TASKS · SOURCE: VALS AI LEADERBOARD, VALS.AI`}</Lab>
      <div style={{display: 'grid', rowGap: 24, marginTop: 56}}>
        {bar('Inkling 2 Mini', c.inkling, P.cobalt, t0 + K * 1.2)}
        {bar(c.opus_label, c.opus, P.ink, t0 + K * 1.2)}
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 64, marginTop: 64}}>
        <Stat k="RANK ON THE LEADERBOARD" v={`${c.rank} of ${c.of}`} sub="TIED SCORE WITH OPUS 5.5" style={show(t, t0 + K * 3.0)} />
        <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, t0 + K * 4.2)}}>
          <Lab>COST PER TEST</Lab>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 40, marginTop: 24}}>
            <Px size={S.xl} color={P.vermilion}>{`$${c.cost_inkling.toFixed(2)}`}</Px>
            <Px size={S.l} color={P.muted} style={{marginTop: 24}}>{`vs $${c.cost_opus.toFixed(2)}`}</Px>
          </div>
          <Lab style={{marginTop: 24}}>INKLING 2 MINI VS OPUS 5.5</Lab>
        </div>
      </div>
    </Body>
  );
};

// ---------- 05/06 · model card bars ----------
const Bars: React.FC<{t: number; t0: number; title: string; rows: any[]}> = ({t, t0, title, rows}) => {
  const fills = [P.cobalt, P.ink, P.rule];
  return (
    <Body>
      <div>
        <Title t={t} t0={t0}>{title}</Title>
        <div style={{display: 'flex', gap: 48, marginTop: 24, ...show(t, t0 + K * 0.6)}}>
          {X.series.map((s: string, i: number) => (
            <div key={s} style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: fills[i]}} /><Lab color={i === 0 ? P.ink : P.muted}>{s.toUpperCase()}</Lab></div>
          ))}
        </div>
      </div>
      <div style={{display: 'grid', rowGap: 32, marginTop: 40}}>
        {rows.map((r, ri) => {
          const t1 = t0 + K * 1.0 + ri * 0.8;
          const k = carry(t, t1 + 0.2, 0.7);
          return (
            <div key={r.name} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16, ...show(t, t1)}}>
              <div style={{display: 'flex', gap: 24, alignItems: 'baseline'}}>
                <Px size={S.m}>{r.name}</Px>
                <Lab>{r.what.toUpperCase()}</Lab>
              </div>
              <div style={{display: 'grid', rowGap: 8, marginTop: 16}}>
                {r.v.map((v: number | null, i: number) => (
                  <div key={i} style={{display: 'grid', gridTemplateColumns: '1fr 120px', columnGap: 24, alignItems: 'center', height: 32}}>
                    {v === null
                      ? <Lab>NOT REPORTED</Lab>
                      : <div style={{height: 24, width: `${v * k}%`, background: fills[i]}} />}
                    <Px size={S.label} color={i === 0 ? P.ink : P.muted} style={{textAlign: 'right'}}>{v === null ? '–' : v.toFixed(1)}</Px>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Body>
  );
};

// ---------- 07 · on a 12 GB card ----------
const Fits: React.FC<{t: number}> = ({t}) => {
  const t0 = T.fits;
  const strike = carry(t, t0 + K * 1.6, 0.35);
  return (
    <Body>
      <Title t={t} t0={t0}>A model at this level, on one consumer GPU</Title>
      <div style={{display: 'grid', gridTemplateColumns: '1fr max-content 1fr', columnGap: 64, alignItems: 'start', marginTop: 56}}>
        <div style={{borderTop: `4px solid ${P.ink}`, paddingTop: 20, ...show(t, t0 + K * 0.8)}}>
          <Lab>THE CARD RECOMMENDS</Lab>
          <div style={{position: 'relative', display: 'inline-block', marginTop: 24}}>
            <Px size={S.xl} color={P.muted}>{`${F.needs_gb}+ GB`}</Px>
            <div style={{position: 'absolute', left: -8, top: 52, height: 16, width: `calc(${strike * 100}% + 16px)`, background: P.ink}} />
          </div>
          <Lab style={{marginTop: 24}}>OF VRAM</Lab>
        </div>
        <div style={{paddingTop: 72, ...show(t, t0 + K * 1.6)}}><Arr size={S.xl} t={t} t0={t0 + K * 1.6} /></div>
        <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, ...show(t, t0 + K * 2.0)}}>
          <Lab color={P.cobaltText}>OUR BOX</Lab>
          <Px size={S.xl} style={{marginTop: 24}}>12 GB</Px>
          <Lab style={{marginTop: 24}}>ONE RTX 3060 · 62 GB RAM</Lab>
          <div style={{marginTop: 24}}><CellBar n={has(R.vram_gib) ? R.vram_gib : null} of={12} cell={44} h={32} gap={6} /></div>
        </div>
      </div>
      <Px size={S.m} style={{marginTop: 56, whiteSpace: 'pre-wrap', lineHeight: '64px', ...show(t, t0 + K * 3.0)}}>
        {MEASURED
          ? `It runs at ${fmt(R.tuned_tps, 1)} tok/s on llama.cpp (PR ${D.engine.pr}).`
          : `It already loads and answers on llama.cpp master (PR ${D.engine.pr}). Tuning is under way.`}
      </Px>
      <div style={{border: `2px solid ${P.ink}`, padding: '20px 24px', marginTop: 40, display: 'flex', gap: 32, alignItems: 'baseline', ...show(t, t0 + K * 4.2)}}>
        <Lab color={P.ink}>KNOWN QUIRK</Lab>
        <Px size={S.label} style={{whiteSpace: 'pre-wrap', lineHeight: '40px'}}>It can get stuck in long reasoning loops. Cap the output tokens.</Px>
      </div>
    </Body>
  );
};

// ---------- 08 · close ----------
const Close: React.FC<{t: number}> = ({t}) => {
  const t0 = T.close;
  return (
    <Body>
      <Px size={S.xl} style={rise(t, t0 + K * 0.2)}>3060 recipe coming soon</Px>
      <Px size={S.l} color={P.cobalt} style={{marginTop: 40, ...show(t, t0 + K * 0.8)}}>{URL}</Px>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 48, rowGap: 24, marginTop: 64}}>
        {CREDITS.map(([key, val], i) => (
          <div key={key} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16, ...show(t, t0 + K * 1.4 + i * 0.2)}}>
            <Lab>{key}</Lab>
            <Px size={S.label} style={{marginTop: 12}}>{val}</Px>
          </div>
        ))}
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 48, marginTop: 24, ...show(t, t0 + K * 2.4)}}>
        <div style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16}}><Lab>SCORES</Lab><Px size={S.label} style={{marginTop: 12}}>Thinking Machines model card · Vals AI</Px></div>
      </div>
    </Body>
  );
};

// ---------- dh card ----------
const DhCard: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{background: P.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
    <Mark cell={48} n={cells(t, T.dh, 21, 0.05)} />
    <div style={{textAlign: 'center', opacity: on(t, T.dh + 0.8) ? 1 : 0}}>
      <div style={{fontFamily: HOOP, fontWeight: 700, fontSize: 56, lineHeight: '64px', color: P.ink}}>David Hatley</div>
      <div style={{fontFamily: MONO, fontSize: 28, lineHeight: '36px', letterSpacing: '0.04em', color: P.muted, marginTop: 12}}>design · AI/ML · generative tools</div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 48}}>
        <Glyph rows={CHIP} cell={6} />
        <span style={{fontFamily: MONO, fontSize: 28, lineHeight: '36px', color: P.ink}}>{URL}</span>
      </div>
    </div>
  </AbsoluteFill>
);

// ---------- composition ----------
const SCENES: Record<string, React.FC<{t: number}>> = {
  what: What, moe: Moe, loop: Loop, cyber: Cyber,
  code: ({t}) => <Bars t={t} t0={T.code} title="Coding" rows={X.code} />,
  docs: ({t}) => <Bars t={t} t0={T.docs} title="Documents and images" rows={X.docs} />,
  fits: Fits, close: Close,
};
const FOOT: Record<string, string> = {
  what: 'SOURCE: HUGGINGFACE.CO/THINKINGMACHINES/INKLING-2-MINI',
  moe: 'SOURCE: THINKING MACHINES MODEL CARD', loop: `SOURCE: MODEL CARD AND THE GGUF HEADER · LLAMA.CPP PR ${D.engine.pr}`,
  cyber: FOOTNOTE, code: FOOTNOTE, docs: FOOTNOTE, fits: `${HW1} · LLAMA.CPP PR ${D.engine.pr}`, close: FOOTNOTE,
};
const Explainer: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const t = useCurrentFrame() / EX_FPS;
  if (t >= T.dh) return <DhCard t={t} />;
  const idx = PLATES.reduce((acc, [k], i) => (t >= T[k] ? i : acc), 0);
  const key = PLATES[idx][0];
  const Scene = SCENES[key];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Chrome t={t} si={idx} foot={FOOT[key]} />
      <Scene t={t} />
    </AbsoluteFill>
  );
};
export const ExplainerLight: React.FC = () => <Explainer theme="light" />;
export const ExplainerDark: React.FC = () => <Explainer theme="dark" />;
