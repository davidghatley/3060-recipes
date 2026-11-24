import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Arr, CHIP, D, DER, DF, FA, Glyph, HW_SHORT, Hop, KL, LA, LG, Lab, MODEL, NS, P, Px, RF, S, ST, STATUS, TBD, Tick, type Theme, URL, fmt, mono, nk, pct, setTheme, useFonts, xfmt} from './kit';

// Stills for the thread, built from the same data as the video:
//   Results (1600x900) · Flags, "which profile" (1600x900) · Poster (1080x1350), each light and dark.
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
    {two ? <><Lab>{`RTX 3060 12 GB · LLAMA.CPP ${String(D.engine.master).toUpperCase()}`}</Lab><Lab style={{marginTop: 8}}>{URL.toUpperCase()}</Lab></> : <Lab>{HW_SHORT}</Lab>}
  </div>
);
const Sun: React.FC<{size: number; children: React.ReactNode; style?: React.CSSProperties}> = ({size, children, style}) => (
  <div style={{display: 'inline-block', background: P.sun, padding: `${size / 8}px ${size / 4}px`, ...style}}>
    <Px size={size} color={P.onSun}>{children}</Px>
  </div>
);

/** Results card, 1600 x 900: the headline on top, three result cards below. */
const Results: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cards: [string, React.ReactNode, string][] = [
    ['THINKING ON', <><Px size={S.m} color={P.muted}>{fmt(ST.decode_on, 1)}</Px><Arr size={S.m} /><Px size={S.m}>{fmt(DF.decode_on, 1)}</Px></>, `${xfmt(DER.x_on)} · MTP N=2`],
    ['DEEP IN THE WINDOW', <><Px size={S.m} color={P.muted}>{fmt(ST.decode_deep, 1)}</Px><Arr size={S.m} /><Px size={S.m}>{fmt(DF.decode_deep, 1)}</Px></>, `${xfmt(DER.x_deep)} · 63K → 60K`],
    ['FAST · Q8_0 HEAD', <Px size={S.m}>{fmt(FA.decode_off, 1)}</Px>, `${xfmt(DER.x_fast)} · KLD ${fmt(KL.head_wiki, 4)}`],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · QWEN3.5-9B HERETIC · ${STATUS}`} />
      <Hop size={S.l} style={{position: 'absolute', left: 48, top: 128}}>{`${MODEL} on a 12 GB RTX 3060`}</Hop>
      <Lab color={P.cobaltText} style={{position: 'absolute', left: 48, top: 232}}>UNCENSORED 9B MERGE · ITS OWN MTP HEAD · ALL IN VRAM</Lab>
      <div style={{position: 'absolute', left: 48, right: 48, top: 296}}>
        <Lab>DECODE TOK/S · THINKING OFF · STOCK → MTP N=2</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 20}}>
          <Px size={S.xl} color={P.muted}>{fmt(ST.decode_off, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(DF.decode_off, 1)}</Sun>
          <Px size={S.xl} color={P.cobaltText} style={{marginLeft: 40}}>{xfmt(DER.x_default)}</Px>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 532, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 32}}>
        {cards.map(([m, big, sub]) => (
          <div key={m} style={{borderTop: `4px solid ${P.ink}`, paddingTop: 16}}>
            <Lab>{m}</Lab>
            <div style={{display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 16}}>{big}</div>
            <Lab color={P.cobaltText} style={{marginTop: 16}}>{sub}</Lab>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 736}}>
        <Lab color={P.ink}>{`PREFILL 8K ${fmt(ST.prefill_8k, 0)} → ${fmt(DF.prefill_8k, 0)} · REFUSALS ${RF.answered_by_hand}/${RF.n} ANSWERED`}</Lab>
      </div>
      <Foot />
    </AbsoluteFill>
  );
};

/** Which profile card, 1600 x 900. */
const PROFILES = (): [string, string, string, string, string][] => [
  ['./serve.sh', '64K · F16', 'N=2', fmt(DF.decode_off, 1), `${fmt(DF.decode_deep, 1)} AT 60K`],
  ['QH_PROFILE=fast', '128K · Q8_0', 'N=2', fmt(FA.decode_off, 1), `${fmt(FA.decode_deep, 1)} AT 120K`],
  ['QH_PROFILE=nospec', '128K · Q8_0', 'NONE', fmt(NS.decode_off, 1), `${fmt(NS.decode_deep, 1)} AT 120K`],
  ['QH_PROFILE=long', '192K · Q4_0', 'NONE', fmt(LG.decode_off, 1), `${fmt(LG.decode_deep, 1)} AT 180K`],
];
const Flags: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '400px 300px 160px 160px 1fr';
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · QWEN3.5-9B HERETIC · ${STATUS}`} />
      <Hop size={S.m} style={{position: 'absolute', left: 48, top: 128}}>Which profile</Hop>
      <div style={{position: 'absolute', left: 48, right: 48, top: 216}}>
        <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 48}}>
          <Lab>LAUNCH</Lab><Lab>WINDOW</Lab><Lab>MTP</Lab><Lab style={{textAlign: 'right'}}>TOK/S</Lab><Lab style={{textAlign: 'right'}}>DEEP</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {PROFILES().map(([f, win, spec, dec, deep]) => (
            <div key={f} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 48, alignItems: 'center', height: 72, borderBottom: `2px solid ${P.faint}`}}>
              <div style={mono(32, P.cobaltText, 600)}>{f}</div>
              <Px size={S.label}>{win}</Px>
              <Px size={S.label} color={spec === 'NONE' ? P.muted : P.ink}>{spec}</Px>
              <Px size={S.label} style={{textAlign: 'right'}}>{dec}</Px>
              <Px size={S.label} color={P.cobaltText} style={{textAlign: 'right'}}>{deep}</Px>
            </div>
          ))}
        </div>
        <Lab style={{marginTop: 12}}>THINKING OFF · NEEDLES 3/3 ON EVERY PROFILE</Lab>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 628}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{background: P.vermilion, padding: '4px 12px'}}><Px size={S.label} color={P.ink}>DEFAULT</Px></div>
          <Lab color={P.ink}>{`THE PUBLISHED FILE · ${fmt(DF.decode_off, 1)} / ${fmt(DF.decode_on, 1)} TOK/S`}</Lab>
        </div>
        <div style={{marginTop: 16, background: P.sheet, outline: `2px solid ${P.ink}`, padding: '16px 24px'}}>
          <div style={mono(32)}>{'-ngl 99 --fit off -c 65536 -np 1 -fa on -ctk f16 -ctv f16'}</div>
          <div style={mono(32)}>{'--spec-type draft-mtp --spec-draft-n-max 2 --jinja'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, bottom: 32}}>
        <Lab>FAST: RUN TOOLS/REQUANT_HEAD.SH ONCE · HEAD → Q8_0</Lab>
      </div>
    </AbsoluteFill>
  );
};

/** Poster, 1080 x 1350 (4:5). */
const Poster: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '1fr 176px 176px 136px';
  const rows: [string, string, string, string][] = [
    ['THINKING OFF', fmt(ST.decode_off, 1), fmt(DF.decode_off, 1), xfmt(DER.x_default)],
    ['THINKING ON', fmt(ST.decode_on, 1), fmt(DF.decode_on, 1), xfmt(DER.x_on)],
    ['DEEP · 63K/60K', fmt(ST.decode_deep, 1), fmt(DF.decode_deep, 1), xfmt(DER.x_deep)],
    ['PREFILL 8K', fmt(ST.prefill_8k, 0), fmt(DF.prefill_8k, 0), pct(-DER.prefill_cost_pct)],
  ];
  const lim: [string, string][] = [
    ['FAST PROFILE', `${fmt(FA.decode_off, 1)} · KLD ${fmt(KL.head_wiki, 4)}`],
    ['BF16 HEAD', `${Math.round(DER.head_pct)}% OF BYTES PER TOKEN`],
    ['LONG ANSWERS', `${LA.mtp.finished}/${LA.mtp.n} BOTH · ${LA.tokens_24k / 1000}K COHERENT`],
    ['NEEDLES', `3/3 · UP TO ${nk(LG.needles_95).replace('.0K', 'K')}`],
    ['REFUSALS', `${RF.answered_by_hand}/${RF.n} · NO BASE RUN`],
    ['QUANT KLD', 'NOT MEASURED'],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128}}>
        <Hop size={S.l}>{`${MODEL}\non a 12 GB RTX 3060`}</Hop>
        <Lab color={P.cobaltText} style={{marginTop: 24}}>{`UNCENSORED ${D.model.size} · OWN MTP HEAD · TOK/S`}</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 24}}>
          <Px size={S.xl} color={P.muted}>{fmt(ST.decode_off, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(DF.decode_off, 1)}</Sun>
        </div>
        <div style={{marginTop: 32, display: 'grid', gridTemplateColumns: cols, columnGap: 24}}>
          <Lab>TOK/S</Lab><Lab style={{textAlign: 'right'}}>STOCK</Lab><Lab style={{textAlign: 'right'}}>MTP</Lab><Lab style={{textAlign: 'right'}}>GAIN</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {rows.map(([m, a, b, x]) => (
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
            <div key={k} style={{display: 'grid', gridTemplateColumns: '336px 1fr', columnGap: 24, padding: '12px 0', borderBottom: `2px solid ${P.faint}`}}>
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
export {D, DER, TBD, Tick};
