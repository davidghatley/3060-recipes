import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Arr, CHIP, D, DER, Glyph, HW_SHORT, Hop, LV, Lab, MODEL, P, Px, S, SIZE, ST, STATUS, TBD, TU, Tick, type Theme, UNC, URL, fmt, mono, pct, pct1, setTheme, useFonts, x2} from './kit';

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
    {two ? <><Lab>RTX 3060 12 GB · 62 GB RAM · LLAMA.CPP</Lab><Lab style={{marginTop: 8}}>{URL.toUpperCase()}</Lab></> : <Lab>{HW_SHORT}</Lab>}
  </div>
);
const Sun: React.FC<{size: number; children: React.ReactNode; style?: React.CSSProperties}> = ({size, children, style}) => (
  <div style={{display: 'inline-block', background: P.sun, padding: `${size / 8}px ${size / 4}px`, ...style}}>
    <Px size={size} color={P.onSun}>{children}</Px>
  </div>
);

/** metric, stock, tuned, speed-up */
const ROWS = (): [string, string, string, string][] => [
  ['DECODE', fmt(ST.decode, 1), fmt(TU.decode, 1), x2(DER.speedup_decode)],
  ['DECODE AT 32K', fmt(ST.decode_32k, 1), fmt(TU.decode_32k, 1), x2(DER.speedup_decode_32k)],
  ['PREFILL 8K', fmt(ST.prefill_8k, 0), fmt(TU.prefill_8k, 0), x2(DER.speedup_prefill_8k)],
  ['PREFILL 32K', fmt(ST.prefill_32k, 0), fmt(TU.prefill_32k, 0), x2(DER.speedup_prefill_32k)],
];

/** Results card, 1600 x 900: the headline on the left, stock vs tuned on the right. */
const Results: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · MAXWELL-V1-FLASH · ${STATUS}`} />
      <Hop size={S.l} style={{position: 'absolute', left: 48, top: 128}}>{`${MODEL} on a 12 GB RTX 3060`}</Hop>
      <Lab color={P.cobaltText} style={{position: 'absolute', left: 48, top: 232}}>{`${SIZE} MOE · ATOMICCHAT ${D.weights.file} ${fmt(D.weights.gb, 1)} GB · 64K CTX`}</Lab>
      <div style={{position: 'absolute', left: 48, right: 48, top: 296}}>
        <Lab>DECODE TOK/S · STOCK LLAMA.CPP → TUNED</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 20}}>
          <Px size={S.xl} color={P.muted}>{fmt(ST.decode, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(TU.decode, 1)}</Sun>
          <Px size={S.xl} color={P.cobaltText} style={{marginLeft: 40}}>{x2(DER.speedup_decode)}</Px>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 532, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 32}}>
        {ROWS().slice(1).map(([m, a, b, x]) => (
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
        <Lab color={P.ink}>{`NEEDLES ${TU.needles_32k?.[1] ?? TBD} AT 32K · NOT CLEAN AT ~62K · CARD ${fmt(TU.vram_gb, 2)} GB`}</Lab>
      </div>
      <Foot />
    </AbsoluteFill>
  );
};

/** Which flags card, 1600 x 900. */
const FLAGS = (): [string, string, string, string, string][] => [
  ['--cpu-moe --moe-cache-mib', 'hot experts on the card', `${fmt(LV.pinned, 1)} → ${fmt(LV.cache, 1)}`, 'DECODE', pct(DER.cache_gain_pct)],
  ['--load-mode none', 'no mmap', `${fmt(LV.lm_ctl, 0)} → ${fmt(LV.lm, 0)}`, 'PREFILL', pct(DER.loadmode_gain_pct)],
  ['-ctk f16 -ctv f16', 'faster deep in the window', `${fmt(LV.q8_32k, 1)} → ${fmt(LV.f16_32k, 1)}`, 'AT 32K', `Q8 −${Math.round(DER.q8_slower_at_32k_pct)}%`],
  ['-ub 1024', 'bigger prefill batches', `${fmt(LV.ub512_pp, 0)} → ${fmt(LV.ub1024_pp, 0)}`, 'PREFILL', pct(DER.ub1024_prefill_pct)],
];
const Flags: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '500px 1fr 290px 160px';
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · MAXWELL-V1-FLASH · ${STATUS}`} />
      <Hop size={S.m} style={{position: 'absolute', left: 48, top: 128}}>Which flags</Hop>
      <div style={{position: 'absolute', left: 48, right: 48, top: 216}}>
        <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32}}>
          <Lab>FLAG</Lab><Lab>WHAT IT DOES</Lab><Lab style={{textAlign: 'right'}}>TOK/S</Lab><Lab style={{textAlign: 'right'}}>GAIN</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {FLAGS().map(([f, what, ab, unit, g]) => (
            <div key={f} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', height: 72, borderBottom: `2px solid ${P.faint}`}}>
              <div style={mono(32, P.cobaltText, 600)}>{f}</div>
              <Tick color={P.muted}>{what}</Tick>
              <div style={{textAlign: 'right'}}><Px size={S.label}>{ab}</Px></div>
              <Px size={S.label} color={P.cobaltText} style={{textAlign: 'right'}}>{g}</Px>
            </div>
          ))}
        </div>
        <Lab style={{marginTop: 12}}>{`EACH AGAINST ITS OWN CONTROLS · -UB 1024 COSTS ${pct1(DER.ub1024_decode_pct)} DECODE`}</Lab>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 628}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{background: P.vermilion, padding: '4px 12px'}}><Px size={S.label} color={P.ink}>DEFAULT</Px></div>
          <Lab color={P.ink}>{`./SERVE.SH · ${fmt(TU.decode, 1)} TOK/S · ${fmt(TU.prefill_8k, 0)} PREFILL`}</Lab>
        </div>
        <div style={{marginTop: 16, background: P.sheet, outline: `2px solid ${P.ink}`, padding: '16px 24px'}}>
          <div style={mono(32)}>{'-ngl 99 --cpu-moe --fit off -c 65536 -fa on --load-mode none'}</div>
          <div style={mono(32)}>{`--moe-cache-mib ${TU.cache_mib} --moe-cache-cpu-share 0.95 -ctk f16 -ctv f16 -ub ${TU.ub}`}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, bottom: 32}}>
        <Lab>{'MX_PROFILE=SHORT: Q8_0 KV · MX_PROFILE=PROMPT: -UB 2048'}</Lab>
      </div>
    </AbsoluteFill>
  );
};

/** Poster, 1080 x 1350 (4:5). */
const Poster: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '1fr 120px 120px 136px';
  const lim: [string, string][] = [
    ['NEEDLES', `${TU.needles_32k?.[1] ?? TBD} AT 32K, NOT CLEAN AT ~62K`],
    ['UNCENSORED LORA', `${fmt(UNC.decode, 1)} TOK/S, ABOUT HALF SPEED`],
    ['MODEL CARD LINE', 'DOES NOT LOAD ON 12 GB'],
    ['DRIFT VS BF16', 'NOT MEASURED'],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128}}>
        <Hop size={S.l}>{`${MODEL}\non a 12 GB RTX 3060`}</Hop>
        <Lab color={P.cobaltText} style={{marginTop: 24}}>{`${SIZE} MOE · DECODE TOK/S`}</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 24}}>
          <Px size={S.xl} color={P.muted}>{fmt(ST.decode, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(TU.decode, 1)}</Sun>
        </div>
        <div style={{marginTop: 24, display: 'grid', gridTemplateColumns: cols, columnGap: 24}}>
          <Lab>TOK/S</Lab><Lab style={{textAlign: 'right'}}>STOCK</Lab><Lab style={{textAlign: 'right'}}>TUNED</Lab><Lab style={{textAlign: 'right'}}>GAIN</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {ROWS().slice(0, 3).map(([m, a, b, x]) => (
            <div key={m} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 24, alignItems: 'center', padding: '12px 0', borderBottom: `2px solid ${P.faint}`}}>
              <Lab color={P.ink}>{m}</Lab>
              <Px size={S.label} color={P.muted} style={{textAlign: 'right'}}>{a}</Px>
              <Px size={S.label} style={{textAlign: 'right'}}>{b}</Px>
              <Px size={S.label} color={P.cobaltText} style={{textAlign: 'right'}}>{x}</Px>
            </div>
          ))}
        </div>
        <div style={{marginTop: 24, borderTop: `4px solid ${P.cobalt}`}}>
          {lim.map(([k, val]) => (
            <div key={k} style={{padding: '10px 0', borderBottom: `2px solid ${P.faint}`}}>
              <Lab>{k}</Lab>
              <Lab color={P.ink} style={{marginTop: 8}}>{val}</Lab>
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
