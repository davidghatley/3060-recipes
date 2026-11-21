import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import exJson from './explainer.json';
import {
  CHIP, CREDITS, D, Glyph, HOOP, LOOP_N, Lab, MONO, Mark, P, Px, S, type Theme, TypeOn,
  URL, carry, cells, on, rise, setTheme, show, useFonts,
} from './kit';
import {LoopFigure, loopEnd} from './Loop';

// Inkling-2-Mini explainer for designers and builders: four plates and the dh card in 30 s, cut to the promo bed.
// Facts and scores from explainer.json (model card, Vals AI).

/* eslint-disable @typescript-eslint/no-explicit-any */
const X = exJson as any;
const T = X.t;
const F = X.facts;
export const EX_FPS: number = X.fps;
export const EX_FRAMES = Math.round(X.total * X.fps);
const M = D.model;
// K scales the entry delays inside a plate; KL is the loop plate's own (kept at v2 pacing).
const K: number = X.k ?? 1;
const KL: number = X.k_loop ?? K;
const FOOTNOTE = 'SCORES REPORTED BY THINKING MACHINES AND VALS AI · NOT OUR MEASUREMENTS';

// ---------- chrome ----------
const L = 48;
const PLATES: [string, string, string][] = [
  ['what', 'WHAT IT IS', 'MODEL CARD'], ['loop', 'THE LOOP', 'MODEL CARD'],
  ['bench', 'BENCHMARKS', 'VALS AI + MODEL CARD'], ['close', 'WHAT IS NEXT', 'COMING SOON'],
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
const Title: React.FC<{t: number; t0: number; k?: number; children: React.ReactNode}> = ({t, t0, k = K, children}) => (
  <Px size={S.l} style={{whiteSpace: 'pre-wrap', lineHeight: '88px', ...rise(t, t0 + k * 0.2)}}>{children}</Px>
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

// ---------- 02 · the loop (v2 pacing) ----------
const Loop: React.FC<{t: number}> = ({t}) => {
  const t0 = T.loop;
  const tm = {go: t0 + KL * 1.4, pre: 0.6, pass: 0.9, back: 0.4};
  const end = loopEnd(tm);
  return (
    <Body>
      <Title t={t} t0={t0} k={KL}>{`The same ${LOOP_N} middle layers run ${M.loop_times} times`}</Title>
      <div style={{marginTop: 48, ...show(t, t0 + KL * 0.8)}}>
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

// ---------- 03 · benchmarks: CyberBench as the hero, the six model card scores as a grid ----------
const Bench: React.FC<{t: number}> = ({t}) => {
  const t0 = T.bench;
  const c = X.cyber;
  const fills = [P.cobalt, P.ink, P.rule];
  const hk = carry(t, t0 + 0.4, 0.5);
  const heroBar = (label: string, v: number, fill: string) => (
    <div style={{display: 'grid', gridTemplateColumns: '410px 1fr 180px', columnGap: 24, alignItems: 'center', height: 48}}>
      <Px size={S.label} color={fill === P.cobalt ? P.ink : P.muted}>{label}</Px>
      <div style={{height: 32, width: `${v * hk}%`, background: fill}} />
      <Px size={S.m} style={{textAlign: 'right'}}>{`${v.toFixed(2)}%`}</Px>
    </div>
  );
  const rows = [...X.code, ...X.docs];
  return (
    <Body>
      <Title t={t} t0={t0}>{`Ties ${c.opus_label.replace(' (CVP)', '')} on ${c.name}`}</Title>
      <Lab style={{marginTop: 8, ...rise(t, t0 + 0.2)}}>SECURITY TASKS · SOURCE: VALS AI LEADERBOARD, VALS.AI</Lab>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 400px 400px', columnGap: 48, marginTop: 24, alignItems: 'start'}}>
        <div style={{display: 'grid', rowGap: 8, ...show(t, t0 + 0.4)}}>
          {heroBar('Inkling 2 Mini', c.inkling, P.cobalt)}
          {heroBar(c.opus_label, c.opus, P.ink)}
        </div>
        <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 16, ...show(t, t0 + 0.9)}}>
          <Lab>RANK</Lab>
          <Px size={S.l} style={{marginTop: 16}}>{`${c.rank} of ${c.of}`}</Px>
          <Lab style={{marginTop: 8}}>ON VALS AI</Lab>
        </div>
        <div style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 16, ...show(t, t0 + 1.2)}}>
          <Lab>COST PER TEST</Lab>
          <Px size={S.l} color={P.vermilion} style={{marginTop: 16}}>{`$${c.cost_inkling.toFixed(2)}`}</Px>
          <Lab style={{marginTop: 8}}>{`OPUS 5.5: $${c.cost_opus.toFixed(2)}`}</Lab>
        </div>
      </div>
      <div style={{borderTop: `2px solid ${P.ink}`, marginTop: 32, paddingTop: 16, ...show(t, t0 + 1.6)}}>
        <Lab color={P.ink}>{`SOURCE: ${X.card_src.toUpperCase()}`}</Lab>
        <div style={{display: 'flex', gap: 40, marginTop: 8}}>
          {X.series.map((sn: string, i: number) => (
            <div key={sn} style={{display: 'flex', gap: 12, alignItems: 'center'}}><div style={{width: 24, height: 24, background: fills[i]}} /><Lab color={i === 0 ? P.ink : P.muted}>{sn.toUpperCase()}</Lab></div>
          ))}
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 48, rowGap: 24, marginTop: 16}}>
        {rows.map((r: any, ri: number) => {
          const t1 = t0 + 1.8 + ri * 0.15;
          const k = carry(t, t1 + 0.1, 0.4);
          return (
            <div key={r.name} style={show(t, t1)}>
              <Px size={S.label}>{r.name}</Px>
              <div style={{display: 'grid', rowGap: 4, marginTop: 8}}>
                {r.v.map((v: number | null, i: number) => (
                  <div key={i} style={{display: 'grid', gridTemplateColumns: '1fr 88px', columnGap: 16, alignItems: 'center', height: 32}}>
                    {v === null
                      ? <Lab>NOT REPORTED</Lab>
                      : <div style={{height: 16, width: `${v * k}%`, background: fills[i]}} />}
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

// ---------- 04 · close ----------
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
const SCENES: Record<string, React.FC<{t: number}>> = {what: What, loop: Loop, bench: Bench, close: Close};
const FOOT: Record<string, string> = {
  what: 'SOURCE: HUGGINGFACE.CO/THINKINGMACHINES/INKLING-2-MINI',
  loop: `SOURCE: MODEL CARD AND THE GGUF HEADER · LLAMA.CPP PR ${D.engine.pr}`,
  bench: FOOTNOTE, close: FOOTNOTE,
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
