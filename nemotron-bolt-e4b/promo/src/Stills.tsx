import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Arr, CHIP, D, DER, Glyph, HW_SHORT, Hop, LV, Lab, MODEL, MU, NS, P, Px, S, ST, STATUS, TBD, TU, Tick, type Theme, URL, fmt, gb, mono, pct1, setTheme, useFonts, x1, x2} from './kit';

// Stills for the thread, built from the same data as the video:
//   Results (1600x900) · Flags, "which flags" (1600x900) · Poster (1080x1350), each light and dark.
// Social surface: sun + cobalt on the results card and poster (the headline sits on a sun field, in on-sun ink);
// the flags card is a plate (cobalt + vermilion, one DEFAULT stamp). Numbers from data.json; a null prints as a dash.

const Head: React.FC<{text: string}> = ({text}) => (
  <>
    <div style={{position: 'absolute', left: 48, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
      <Glyph rows={CHIP} cell={6} color={P.cobalt} />
      <Lab>{text}</Lab>
    </div>
    <div style={{position: 'absolute', left: 48, right: 48, top: 96, height: 2, background: P.rule}} />
  </>
);
const Foot: React.FC<{two?: boolean}> = ({two}) => (
  <div style={{position: 'absolute', left: 48, right: 48, bottom: 32, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
    {two ? <><Lab>RTX 3060 12 GB · STOCK LLAMA.CPP</Lab><Lab style={{marginTop: 8}}>{URL.toUpperCase()}</Lab></> : <Lab>{HW_SHORT}</Lab>}
  </div>
);
const Sun: React.FC<{size: number; children: React.ReactNode; style?: React.CSSProperties}> = ({size, children, style}) => (
  <div style={{display: 'inline-block', background: P.sun, padding: `${size / 8}px ${size / 4}px`, ...style}}>
    <Px size={size} color={P.onSun}>{children}</Px>
  </div>
);

/** metric, card command, tuned default, speed-up */
const ROWS = (): [string, string, string, string][] => [
  ['THINKING ON', fmt(ST.decode_think, 1), fmt(TU.decode_think, 1), x1(DER.speedup_think)],
  ['THINKING OFF', fmt(ST.decode_off, 1), fmt(TU.decode_off, 1), x1(DER.speedup_off)],
  ['AT 60K', fmt(ST.decode_60k, 1), fmt(TU.decode_60k, 1), x1(DER.speedup_60k)],
  ['PREFILL 8K', fmt(ST.prefill_8k, 0), fmt(TU.prefill_8k, 0), x2(DER.prefill_ratio_8k)],
];
const ID = `3060-RECIPES · ${MODEL.toUpperCase()} · ${STATUS}`;

/** Results card, 1600 x 900: the headline, three comparisons (one of them the price), the multi-user line. */
const Results: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cells: [string, string, string, string][] = [
    ['THINKING OFF', ...ROWS()[1].slice(1)] as [string, string, string, string],
    ['DECODE AT 60K', ...ROWS()[2].slice(1)] as [string, string, string, string],
    ['PREFILL 8K · THE PRICE', ...ROWS()[3].slice(1)] as [string, string, string, string],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={ID} />
      <Hop size={S.l} style={{position: 'absolute', left: 48, top: 128}}>{`${MODEL} on a 12 GB RTX 3060`}</Hop>
      <Lab color={P.cobaltText} style={{position: 'absolute', left: 48, top: 232}}>{`NVIDIA · GEMMA-4-E4B BASE · Q4_K_M ${fmt(D.weights.gb, 2)} GB · ALL IN VRAM`}</Lab>
      <div style={{position: 'absolute', left: 48, right: 48, top: 296}}>
        <Lab>DECODE TOK/S · THINKING ON · CARD → + DFLASH DRAFTER</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 20}}>
          <Px size={S.xl} color={P.muted}>{fmt(ST.decode_think, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(TU.decode_think, 1)}</Sun>
          <Px size={S.xl} color={P.cobaltText} style={{marginLeft: 40}}>{x1(DER.speedup_think)}</Px>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 532, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 48}}>
        {cells.map(([m, a, b, x]) => (
          <div key={m} style={{borderTop: `4px solid ${P.ink}`, paddingTop: 16}}>
            <Lab>{m}</Lab>
            <div style={{display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 16}}>
              <Px size={S.m} color={P.muted}>{a}</Px><Arr size={S.m} /><Px size={S.m}>{b}</Px>
            </div>
            <Px size={S.label} color={P.cobaltText} style={{marginTop: 16}}>{x}</Px>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 724}}>
        <Lab color={P.ink}>{`4 USERS × 32K: ${fmt(MU.c4, 1)} TOK/S TOTAL · NEEDLES ${TU.needles_61k?.[1] ?? TBD} AT 61K`}</Lab>
        <Lab color={P.ink} style={{marginTop: 8}}>{`NB_PROFILE=NOSPEC: ${fmt(NS.prefill_8k, 0)} PREFILL AT 8K · CARD ${gb(TU.vram_mib)} GB`}</Lab>
      </div>
      <Foot />
    </AbsoluteFill>
  );
};

/** Which flags card, 1600 x 900. Each lever against the controls run either side of it. */
const FLAGS = (): [string, string, string, string][] => [
  ['--spec-type draft-dflash', "the card's drafter", `${fmt(LV.df_ctl_think, 1)} → ${fmt(LV.df_think, 1)}`, x1(DER.df_lever_think)],
  ['-ub 1024', 'bigger prefill batches', `${fmt(LV.ub_ctl_pp8k, 0)} → ${fmt(LV.ub_pp8k, 0)}`, pct1(DER.ub1024_pp8k_pct)],
  ['-bs', 'backend sampling', 'GREEDY SAME', '+1.5–5%'],
  ['-ctk f16 -ctv f16', 'quantized K/V is slower', `${fmt(LV.q8_32k, 1)} → ${fmt(LV.kv_ctl_32k, 1)}`, `Q8 −${Math.round(DER.q8_slower_at_32k_pct)}%`],
];
const Flags: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '480px 1fr 340px 180px';
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={ID} />
      <Hop size={S.m} style={{position: 'absolute', left: 48, top: 120}}>Which flags</Hop>
      <div style={{position: 'absolute', left: 48, right: 48, top: 200}}>
        <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32}}>
          <Lab>FLAG</Lab><Lab>WHAT IT DOES</Lab><Lab style={{textAlign: 'right'}}>TOK/S</Lab><Lab style={{textAlign: 'right'}}>GAIN</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {FLAGS().map(([f, what, ab, g]) => (
            <div key={f} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', height: 72, borderBottom: `2px solid ${P.faint}`}}>
              <div style={mono(32, P.cobaltText, 600)}>{f}</div>
              <Tick color={P.muted}>{what}</Tick>
              <div style={{textAlign: 'right'}}><Px size={S.label}>{ab}</Px></div>
              <Px size={S.label} color={P.cobaltText} style={{textAlign: 'right'}}>{g}</Px>
            </div>
          ))}
        </div>
        <Lab style={{marginTop: 12}}>EACH AGAINST ITS OWN CONTROLS · -BS IS EXPERIMENTAL</Lab>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 612}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{background: P.vermilion, padding: '4px 12px'}}><Px size={S.label} color={P.ink}>DEFAULT</Px></div>
          <Lab color={P.ink}>{`./SERVE.SH · ${fmt(TU.decode_think, 1)} TOK/S · ${fmt(TU.prefill_8k, 0)} PREFILL AT 8K`}</Lab>
        </div>
        <div style={{marginTop: 16, background: P.sheet, outline: `2px solid ${P.ink}`, padding: '12px 24px'}}>
          <div style={mono(32)}>{'-ngl 999 -c 65536 -np 1 -ub 1024 -fa on -ctk f16 -ctv f16 -bs'}</div>
          <div style={mono(32)}>{'--spec-draft-model <DFlash GGUF> --spec-type draft-dflash'}</div>
          <div style={mono(32)}>{'--spec-draft-n-max 7 --spec-draft-ngl 999 --jinja --reasoning on'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, bottom: 24}}>
        <Lab>{`NB_PROFILE=NOSPEC: NO DRAFTER, ${fmt(NS.prefill_8k, 0)} PREFILL AT 8K`}</Lab>
      </div>
    </AbsoluteFill>
  );
};

/** Poster, 1080 x 1350 (4:5). */
const Poster: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '1fr 200px 200px 160px';
  const lim: [string, string][] = [
    ['4 USERS × 32K', `${fmt(MU.c4, 1)} TOK/S TOTAL`],
    ['NEEDLES', `${TU.needles_61k?.[1] ?? TBD} AT 61K, ALL PROFILES`],
    ['LONG PROMPTS', `NOSPEC ${fmt(NS.prefill_8k, 0)} AT 8K`],
    ['NOT MEASURED', 'KLD, CHAT ACCEPTANCE'],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128}}>
        <Hop size={S.l}>{`${MODEL}\non a 12 GB RTX 3060`}</Hop>
        <Lab color={P.cobaltText} style={{marginTop: 24}}>NVIDIA · GEMMA-4-E4B BASE · ALL IN VRAM</Lab>
        <Lab style={{marginTop: 16}}>DECODE TOK/S · THINKING ON · + DFLASH</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 24}}>
          <Px size={S.xl} color={P.muted}>{fmt(ST.decode_think, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(TU.decode_think, 1)}</Sun>
        </div>
        <div style={{marginTop: 32, display: 'grid', gridTemplateColumns: cols, columnGap: 24}}>
          <Lab>TOK/S</Lab><Lab style={{textAlign: 'right'}}>CARD</Lab><Lab style={{textAlign: 'right'}}>DFLASH</Lab><Lab style={{textAlign: 'right'}}>GAIN</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {ROWS().map(([m, a, b, x]) => (
            <div key={m} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 24, alignItems: 'center', padding: '12px 0', borderBottom: `2px solid ${P.faint}`}}>
              <Lab color={P.ink}>{m}</Lab>
              <Px size={S.label} color={P.muted} style={{textAlign: 'right'}}>{a}</Px>
              <Px size={S.label} style={{textAlign: 'right'}}>{b}</Px>
              <Px size={S.label} color={P.cobaltText} style={{textAlign: 'right'}}>{x}</Px>
            </div>
          ))}
        </div>
        <div style={{marginTop: 32, borderTop: `4px solid ${P.cobalt}`}}>
          {lim.map(([k, val]) => (
            <div key={k} style={{display: 'grid', gridTemplateColumns: '330px 1fr', columnGap: 24, padding: '12px 0', borderBottom: `2px solid ${P.faint}`}}>
              <Lab>{k}</Lab>
              <Lab color={P.ink}>{val}</Lab>
            </div>
          ))}
        </div>
      </div>
      <Foot two />
    </AbsoluteFill>
  );
};

export const ResultsLight: React.FC = () => <Results theme="light" />;
export const ResultsDark: React.FC = () => <Results theme="dark" />;
export const FlagsLight: React.FC = () => <Flags theme="light" />;
export const FlagsDark: React.FC = () => <Flags theme="dark" />;
export const PosterLight: React.FC = () => <Poster theme="light" />;
export const PosterDark: React.FC = () => <Poster theme="dark" />;
export {D, DER};
