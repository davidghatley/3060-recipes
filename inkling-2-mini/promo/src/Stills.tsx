import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CHIP, D, Glyph, HW1, HW2, LOOP_N, Lab, MODEL, P, Px, QUANT, R, S, SIZE, STATUS, type Theme, TBD, URL, Arr, ctxLabel, fmt, has, setTheme, useFonts, xfmt} from './kit';
import {LoopFigure} from './Loop';

// Stills from the same parts as the video: README header (1280x320), social 16:9 (1200x675) and square (1080x1080).
// Each in light (Plaster) and dark (Night). Numbers from data.json; a null prints as a dash.
// Inks: the header is a docs surface (cobalt + vermilion); the social cards use sun + cobalt.

const M = D.model;
const TM = {go: 0, pre: 1, pass: 1, back: 1};
const DONE = Infinity;
const Head: React.FC<{left: number; top: number; right: number; text?: string}> = ({left, top, right, text = `3060-RECIPES · INKLING-2-MINI · ${STATUS}`}) => (
  <>
    <div style={{position: 'absolute', left, top, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
      <Glyph rows={CHIP} cell={6} color={P.cobalt} />
      <Lab>{text}</Lab>
    </div>
    <div style={{position: 'absolute', left, right, top: top + 64, height: 2, background: P.rule}} />
  </>
);
const Foot: React.FC<{left: number; right: number; bottom: number; two?: boolean}> = ({left, right, bottom, two}) => (
  <div style={{position: 'absolute', left, right, bottom, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
    {two ? <><Lab>{HW1}</Lab><Lab style={{marginTop: 8}}>{`${HW2} · ${URL.toUpperCase()}`}</Lab></> : <Lab>{HW1}</Lab>}
  </div>
);
const Decode: React.FC<{size: number; gap?: number}> = ({size, gap = 32}) => (
  <div style={{display: 'flex', alignItems: 'flex-start', gap}}>
    <Px size={size} color={P.muted}>{fmt(R.baseline_tps, 1)}</Px>
    <Arr size={size} />
    <Px size={size}>{fmt(R.tuned_tps, 1)}</Px>
  </div>
);

/** Social cards use the social ink pair, sun + cobalt: the speedup sits on a sun field, set in on-sun ink. */
const SunNum: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => (
  <div style={{display: 'inline-block', background: P.sun, padding: `${size / 8}px ${size / 4}px`, ...style}}>
    <Px size={size} color={P.onSun}>{xfmt(R.speedup)}</Px>
  </div>
);

/** README header, 1280 x 320. GitHub shows it at about 65%, so nothing under 32 px Stem 7. */
const Header: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', left: 48, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
        <Glyph rows={CHIP} cell={6} color={P.cobalt} />
        <Lab>{`3060-RECIPES · ${STATUS}`}</Lab>
      </div>
      <Px size={S.m} style={{position: 'absolute', left: 48, top: 88}}>{MODEL}</Px>
      <Lab color={P.ink} style={{position: 'absolute', left: 48, top: 152}}>ON A 12 GB RTX 3060</Lab>
      <Lab style={{position: 'absolute', left: 48, top: 196}}>{`${SIZE} · LLAMA.CPP`}</Lab>
      <div style={{position: 'absolute', left: 48, top: 248, display: 'flex', alignItems: 'flex-start', gap: 16}}>
        <Px size={S.m}>{fmt(R.tuned_tps, 1)}</Px>
        <Lab style={{marginTop: 12}}>TOK/S</Lab>
        <Px size={S.m} color={P.vermilion} style={{marginLeft: 24}}>{xfmt(R.speedup)}</Px>
        <Lab style={{marginTop: 12}}>VS STOCK</Lab>
      </div>
      <div style={{position: 'absolute', right: 48, top: 40}}>
        <LoopFigure t={DONE} tm={TM} cw={16} ch={136} gap={4} gg={16} lab={32} big={S.m} loopH={40} ends={false} counter={false} labels={false} />
      </div>
    </AbsoluteFill>
  );
};

/** Social card, 16:9 at 1200 x 675. */
const Social: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head left={48} right={48} top={32} />
      <Px size={S.m} style={{position: 'absolute', left: 48, top: 128, lineHeight: '64px'}}>{`${MODEL} ${SIZE}\non a 12 GB RTX 3060`}</Px>
      <div style={{position: 'absolute', left: 48, top: 280}}>
        <Lab>STOCK → TUNED · TOK/S</Lab>
        <div style={{marginTop: 24}}><Decode size={S.l} gap={24} /></div>
        <SunNum size={S.xl} style={{marginTop: 24}} />
      </div>
      <div style={{position: 'absolute', right: 48, top: 296}}>
        <LoopFigure t={DONE} tm={TM} cw={16} ch={72} gap={4} gg={16} lab={32} big={S.l} loopH={48} ends={false} counter={false} />
      </div>
      <Foot left={48} right={48} bottom={32} />
    </AbsoluteFill>
  );
};

/** Square card, 1080 x 1080. */
const Square: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head left={48} right={48} top={32} text={`3060-RECIPES · ${STATUS}`} />
      <Px size={S.l} style={{position: 'absolute', left: 48, top: 136, lineHeight: '88px'}}>{`${MODEL}\non a 12 GB\nRTX 3060`}</Px>
      <div style={{position: 'absolute', left: 48, top: 432}}>
        <Lab color={P.cobaltText}>{`${SIZE} · LAYERS ${M.loop_first}–${M.loop_last} RUN ${M.loop_times}×`}</Lab>
        <div style={{marginTop: 16}}><LoopFigure t={DONE} tm={TM} cw={32} ch={96} gap={6} gg={24} lab={32} big={S.l} loopH={56} ends={false} counter={false} /></div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 808, borderTop: `4px solid ${P.ink}`, paddingTop: 20}}>
        <Lab>{`TOK/S · ${QUANT} · ${has(R.ctx) ? ctxLabel(R.ctx) : TBD} CTX`}</Lab>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 24}}>
          <Decode size={S.l} gap={24} />
          <SunNum size={S.l} style={{marginTop: -16}} />
        </div>
      </div>
      <Foot left={48} right={48} bottom={32} />
    </AbsoluteFill>
  );
};

export const HeaderLight: React.FC = () => <Header theme="light" />;
export const HeaderDark: React.FC = () => <Header theme="dark" />;
export const SocialLight: React.FC = () => <Social theme="light" />;
export const SocialDark: React.FC = () => <Social theme="dark" />;
export const SquareLight: React.FC = () => <Square theme="light" />;
export const SquareDark: React.FC = () => <Square theme="dark" />;
