import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Arr, CHIP, D, Glyph, HW1, HW2, HW_SHORT, Hop, Lab, MEM, MODEL, NAMES, P, PF, PI, Px, S, STATUS, Tick, type Theme, URL, fmt, setTheme, useFonts, xfmt} from './kit';
import {FamilyRows, FlagRows, Key, LayerRow, MtpLine, WindowCols} from './Plates';

// Stills for the thread, built from the same parts as the video:
//   Results (1600x900) · Flags (1600x900) · Poster (1080x1350), each light and dark.
// Social surface: sun + cobalt on the cards (the gain sits on a sun field, in on-sun ink); the flags card keeps
// the MTP stamp as its one vermilion mark. Numbers from data.json; a null prints as a dash.

const DONE = 1e9;
const DEF = PF.default, FAST = PF.fast;

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
const SunNum: React.FC<{size: number; v: number | null; style?: React.CSSProperties}> = ({size, v, style}) => (
  <div style={{display: 'inline-block', background: P.sun, padding: `${size / 8}px ${size / 4}px`, ...style}}>
    <Px size={size} color={P.onSun}>{xfmt(v)}</Px>
  </div>
);

/** Results card, 1600 x 900: the headline on the left, the family on the right. */
const Results: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · QWEN3.8-27B FAMILY · ${STATUS}`} />
      <Hop size={S.l} style={{position: 'absolute', left: 48, top: 128}}>{`${MODEL} on a 12 GB RTX 3060`}</Hop>
      <div style={{position: 'absolute', left: 48, top: 264, width: 640}}>
        <Lab>PI-ADAPTED · 32K · TOK/S</Lab>
        <Lab style={{marginTop: 8}}>STOCK FLAGS → TUNED</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: 32}}>
          <Px size={S.xl} color={P.muted}>{fmt(PI.stock.decode, 1)}</Px>
          <Arr size={S.xl} />
          <Px size={S.xl}>{fmt(DEF.decode, 1)}</Px>
        </div>
        <SunNum size={S.xl} v={PI.speedup} style={{marginTop: 32}} />
        <Lab style={{marginTop: 32}}>{`${fmt(FAST.decode, 1)} AT 16K, ALL ON GPU`}</Lab>
      </div>
      <div style={{position: 'absolute', left: 776, right: 48, top: 264}}>
        <Lab>FOUR FINETUNES · ONE CONFIG</Lab>
        <div style={{marginTop: 24, borderTop: `4px solid ${P.ink}`}}>
          {MEM.map((m: any) => (
            <div key={m.id} style={{display: 'grid', gridTemplateColumns: '1fr max-content max-content', columnGap: 32, alignItems: 'center', padding: '20px 0', borderBottom: `2px solid ${P.faint}`}}>
              <div><Tick>{NAMES[m.id]}</Tick><Lab style={{marginTop: 8}}>{m.by.toUpperCase()}</Lab></div>
              <Px size={S.m}>{fmt(m.tuned, 1)}</Px>
              <Px size={S.m} color={P.cobaltText} style={{minWidth: 150, textAlign: 'right'}}>{xfmt(m.speedup)}</Px>
            </div>
          ))}
        </div>
      </div>
      <Foot />
    </AbsoluteFill>
  );
};

/** Which-flags card, 1600 x 900. */
const Flags: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · QWEN3.8-27B FAMILY · THE FLAGS · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <Hop size={S.m}>Four changes to stock llama.cpp</Hop>
        <div style={{display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 4}}>
          <Px size={S.m} color={P.muted}>{fmt(PI.stock.decode, 1)}</Px><Arr size={S.m} /><Px size={S.m}>{fmt(DEF.decode, 1)}</Px><Lab style={{marginTop: 8}}>TOK/S</Lab>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 208}}>
        <FlagRows t={DONE} t0={0} size={32} note={S.label} stack={false} pad={18} />
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 572}}>
        <Lab color={P.ink}>64 LAYERS · WHERE EACH ONE LIVES</Lab>
        {([['STOCK', PI.stock.layers_in_ram, 0], ['TUNED', 0, DEF.ffn_in_ram]] as [string, number, number][]).map(([lab, whole, ffn], i) => (
          <div key={lab} style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: i ? 10 : 16}}>
            <Tick color={i ? P.ink : P.muted} style={{width: 156}}>{lab}</Tick>
            <LayerRow whole={whole} ffn={ffn} cw={16} ch={36} gap={4.4} />
          </div>
        ))}
        <Key style={{marginTop: 14, marginLeft: 180}} />
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 772}}><MtpLine t={DONE} t0={0} v={false} stamp={S.label} /></div>
    </AbsoluteFill>
  );
};

/** Poster, 1080 x 1350 (4:5). */
const Poster: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128}}>
        <Hop size={S.l}>{`${MODEL}\non a 12 GB RTX 3060`}</Hop>
        <Lab style={{marginTop: 24}}>PI-ADAPTED · 32K · TOK/S</Lab>
        <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 24}}>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 24}}>
            <Px size={S.xl} color={P.muted}>{fmt(PI.stock.decode, 1)}</Px>
            <Arr size={S.xl} />
            <Px size={S.xl}>{fmt(DEF.decode, 1)}</Px>
          </div>
          <SunNum size={S.l} v={PI.speedup} />
        </div>
        <div style={{marginTop: 40}}>
          <Lab>FOUR FINETUNES · ONE CONFIG</Lab>
          <div style={{marginTop: 16}}><FamilyRows t={DONE} t0={0} v={false} num={S.m} barH={24} gapY={18} nameW={200} noBy /></div>
        </div>
        <div style={{marginTop: 32}}><WindowCols t={DONE} t0={0} v={false} big={S.l} compact /></div>
        <Lab style={{marginTop: 16}}>NEEDLES 3/3 IN EVERY WINDOW</Lab>
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
export {D};
