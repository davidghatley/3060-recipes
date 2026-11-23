import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AD, Arr, BASE, CHIP, D, DER, Glyph, HW_SHORT, Hop, Lab, MODEL, P, Px, S, STATUS, TBD, Tick, type Theme, URL, V, fmt, mono, pct, setTheme, useFonts} from './kit';
import {NAME, ProbeKey, ProbeRows, SPEED_IDS} from './Plates';

// Stills for the thread, built from the same parts as the video:
//   Results (1600x900) · Flags, "which file / which flags" (1600x900) · Poster (1080x1350), each light and dark.
// Social surface: sun + cobalt on the results card and poster (the headline sits on a sun field, in on-sun ink);
// the flags card is a plate (cobalt + vermilion, one DEFAULT stamp). Numbers from data.json; a null prints as a dash.

const DONE = 1e9;

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
    {two ? <><Lab>{`RTX 3060 12 GB · ${HW_SHORT.split(' · ').pop()}`}</Lab><Lab style={{marginTop: 8}}>{URL.toUpperCase()}</Lab></> : <Lab>{HW_SHORT}</Lab>}
  </div>
);
const Sun: React.FC<{size: number; children: React.ReactNode; style?: React.CSSProperties}> = ({size, children, style}) => (
  <div style={{display: 'inline-block', background: P.sun, padding: `${size / 8}px ${size / 4}px`, ...style}}>
    <Px size={size} color={P.onSun}>{children}</Px>
  </div>
);
const ans = (id: string) => (V[id]?.refusal ? `${V[id].refusal.answered}/${V[id].refusal.n}` : TBD);
const kld3 = (id: string) => fmt(V[id]?.kld?.[0], id === 'base' ? 4 : 3);

/** Results card, 1600 x 900: the headline on the left, every variant on the right. */
const Results: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const r0 = BASE.refusal, r1 = AD.refusal;
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · INKLING-2-MINI UNCENSORED · ${STATUS}`} />
      <Hop size={S.l} style={{position: 'absolute', left: 48, top: 128}}>{`${MODEL}, uncensored`}</Hop>
      <Lab color={P.cobaltText} style={{position: 'absolute', left: 48, top: 232}}>12 GB RTX 3060 · ATOMICCHAT AD-Q4_K · 64K</Lab>
      <div style={{position: 'absolute', left: 48, top: 304, width: 560}}>
        <Lab>{`PROBE ANSWERED, OF ${r1?.n ?? TBD}`}</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 24}}>
          <Px size={S.xl} color={P.muted}>{r0 ? String(r0.answered) : TBD}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{r1 ? String(r1.answered) : TBD}</Sun>
        </div>
        <Lab style={{marginTop: 32}}>DECODE TOK/S</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 16}}>
          <Px size={S.m} color={P.muted}>{fmt(BASE.decode, 1)}</Px><Arr size={S.m} /><Px size={S.m}>{fmt(AD.decode, 1)}</Px>
        </div>
        <Lab style={{marginTop: 32}}>KLD VS Q8_0</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 16}}>
          <Px size={S.m} color={P.muted}>{fmt(BASE.kld?.[0], 4)}</Px><Arr size={S.m} /><Px size={S.m}>{fmt(AD.kld?.[0], 3)}</Px>
        </div>
      </div>
      <div style={{position: 'absolute', left: 672, right: 48, top: 304}}>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 112px 168px 136px', columnGap: 24}}>
          <Lab>VARIANT</Lab><Lab style={{textAlign: 'right'}}>TOK/S</Lab><Lab style={{textAlign: 'right'}}>KLD</Lab><Lab style={{textAlign: 'right'}}>PROBE</Lab>
        </div>
        <div style={{marginTop: 16, borderTop: `4px solid ${P.ink}`}}>
          {SPEED_IDS.map((id) => (
            <div key={id} style={{display: 'grid', gridTemplateColumns: '1fr 112px 168px 136px', columnGap: 24, alignItems: 'center', padding: '20px 0', borderBottom: `2px solid ${P.faint}`}}>
              <Tick color={id === 'base' ? P.muted : P.ink}>{NAME[id]}</Tick>
              <Px size={S.label} style={{textAlign: 'right'}}>{fmt(V[id].decode, 1)}</Px>
              <Px size={S.label} style={{textAlign: 'right'}}>{kld3(id)}</Px>
              <Px size={S.label} style={{textAlign: 'right'}}>{ans(id)}</Px>
            </div>
          ))}
        </div>
        <Lab style={{marginTop: 20}}>{`CODEEVAL ${AD.codeeval?.join('/')} ON ALL FIVE`}</Lab>
      </div>
      <Foot />
    </AbsoluteFill>
  );
};

/** Which file / which flags card, 1600 x 900. */
const ROWS: [string, string, string][] = [
  ['atomicchat', 'AD-Q4_K 16.5 GB', 'the default'],
  ['nokeepai-merged', 'IQ4_NL + MERGE', 'nokeepai at full speed'],
  ['nokeepai', 'IQ4_NL + LORA', 'no merge step'],
  ['atomicchat-lora', 'IQ4_NL + LORA', 'slow: use the baked file'],
  ['base', 'IQ4_NL', 'the control'],
];
const Flags: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '320px 400px 280px 1fr';
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · INKLING-2-MINI UNCENSORED · ${STATUS}`} />
      <Hop size={S.m} style={{position: 'absolute', left: 48, top: 128}}>Which file, which flags</Hop>
      <div style={{position: 'absolute', left: 48, right: 48, top: 216}}>
        <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32}}>
          <Lab>VARIANT=</Lab><Lab>WEIGHTS</Lab><Lab style={{textAlign: 'right'}}>TOK/S · PP</Lab><Lab style={{paddingLeft: 24}}>USE</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {ROWS.map(([id, w, use]) => (
            <div key={id} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', height: 68, borderBottom: `2px solid ${P.faint}`}}>
              <div style={mono(32, P.cobaltText, 600)}>{id}</div>
              <Lab color={P.ink}>{w}</Lab>
              <Px size={S.label} style={{textAlign: 'right'}}>{`${fmt(V[id].decode, 1)} · ${fmt(V[id].prefill_8k, 0)}`}</Px>
              <div style={{paddingLeft: 24, display: 'flex', alignItems: 'center'}}>
                {id === 'atomicchat' ? <div style={{background: P.vermilion, padding: '4px 12px'}}><Px size={S.label} color={P.ink}>DEFAULT</Px></div> : <Tick color={P.muted}>{use}</Tick>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 640}}>
        <Lab color={P.ink}>THE BASE RECIPE'S LAYOUT · ONLY -UB 96 IS NEW</Lab>
        <div style={{marginTop: 16, background: P.sheet, outline: `2px solid ${P.ink}`, padding: '16px 24px'}}>
          <div style={mono(32)}>{"-ngl 99 -ot 'blk\\.([0-5]|1[89]|2[0-3])\\.ffn_.*_exps=CPU' --fit off"}</div>
          <div style={mono(32)}>{'-c 65536 -ub 96 -b 2048 -fa on -ctk q8_0 -ctv q8_0 -t 6'}</div>
        </div>
        <Lab style={{marginTop: 16}}>TOK/S: DECODE · PREFILL AT 8K</Lab>
      </div>
    </AbsoluteFill>
  );
};

/** Poster, 1080 x 1350 (4:5). */
const Poster: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const r0 = BASE.refusal, r1 = AD.refusal;
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128}}>
        <Hop size={S.l}>{`${MODEL}, uncensored,\non a 12 GB RTX 3060`}</Hop>
        <Lab style={{marginTop: 24}}>{`PROBE ANSWERED, OF ${r1?.n ?? TBD}`}</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 24}}>
          <Px size={S.xl} color={P.muted}>{r0 ? String(r0.answered) : TBD}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{r1 ? String(r1.answered) : TBD}</Sun>
        </div>
        <div style={{marginTop: 40}}>
          <ProbeRows t={DONE} t0={0} v={false} cell={19} h={40} gap={4} num={S.label} pad={14} nameW={280} />
        </div>
        <ProbeKey style={{marginTop: 20}} />
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 32, marginTop: 40}}>
          {([['TOK/S', fmt(AD.decode, 1)], ['KLD', fmt(AD.kld?.[0], 3)], ['NEEDLES 62K', AD.needles?.[1]?.[1] ?? TBD]] as [string, string][]).map(([l, n]) => (
            <div key={l} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 16}}>
              <Lab color={P.ink}>{l}</Lab>
              <Px size={S.l} style={{marginTop: 16}}>{n}</Px>
            </div>
          ))}
        </div>
        <Lab style={{marginTop: 20}}>{`UNEDITED: ${fmt(BASE.decode, 1)} TOK/S, KLD ${fmt(BASE.kld?.[0], 4)}`}</Lab>
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
