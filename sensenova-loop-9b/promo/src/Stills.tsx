import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Arr, CHIP, CTL, D, DER, GR, Glyph, HW_SHORT, Hop, LONG, Lab, MODEL, P, Px, S, SIZE, ST, STATUS, TBD, TU, Tick, type Theme, UNC, URL, ctxK, fmt, mono, pct, setTheme, useFonts} from './kit';

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
    {two ? <><Lab>{`RTX 3060 12 GB · LLAMA.CPP + PR #${D.engine.pr}`}</Lab><Lab style={{marginTop: 8}}>{URL.toUpperCase()}</Lab></> : <Lab>{HW_SHORT}</Lab>}
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
    ['THINKING ON', <><Px size={S.m} color={P.muted}>{fmt(CTL.on_mean, 1)}</Px><Arr size={S.m} /><Px size={S.m}>{fmt(TU.decode_on, 1)}</Px></>, `${pct(DER.gain_on_pct)} · MIN ${fmt(TU.range_on?.[0], 1)}`],
    ['LONG 256K · NEEDLES', <Px size={S.m}>{`${LONG.needles_248k?.[1] ?? TBD} AT 248K`}</Px>, `${fmt(LONG.ttft_248k, 0)} S TO 1ST TOKEN`],
    ['UNCENSORED PROBE', <Px size={S.m}>{`${UNC.answered_by_hand}/${UNC.probe_n}`}</Px>, `DEFAULT ${UNC.answered_default_by_hand}/${UNC.probe_n}`],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · SENSENOVA-LOOP-9B · ${STATUS}`} />
      <Hop size={S.l} style={{position: 'absolute', left: 48, top: 128}}>{`${MODEL} on a 12 GB RTX 3060`}</Hop>
      <Lab color={P.cobaltText} style={{position: 'absolute', left: 48, top: 232}}>{`${SIZE} LOOPED HYBRID · LAYERS ${D.model.loop} RUN TWICE · ${ctxK(D.ctx)} CTX`}</Lab>
      <div style={{position: 'absolute', left: 48, right: 48, top: 296}}>
        <Lab>DECODE TOK/S · THINKING OFF · PLAIN → MTP N=2 · MEDIANS</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 20}}>
          <Px size={S.xl} color={P.muted}>{fmt(CTL.off_mean, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(TU.decode_off, 1)}</Sun>
          <Px size={S.xl} color={P.cobaltText} style={{marginLeft: 40}}>{pct(DER.gain_off_pct)}</Px>
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
        <Lab color={P.ink}>{`PREFILL 8K ${fmt(ST.prefill_8k, 0)} → ${fmt(TU.prefill_8k, 0)} · ${fmt(TU.vram_mib)} MIB ON THE CARD`}</Lab>
      </div>
      <Foot />
    </AbsoluteFill>
  );
};

/** Which profile card, 1600 x 900. */
const PROFILES = (): [string, string, string, string, string][] => [
  ['./serve.sh', '128K · Q8_0', 'MTP N=2', `${fmt(TU.decode_off, 1)}`, `${TU.needles_124k?.[1] ?? TBD} AT 124K`],
  ['VARIANT=uncensored', '128K · Q8_0', 'NONE', `${fmt(UNC.tuned, 1)}`, `${UNC.needles_124k?.[1] ?? TBD} AT 124K`],
  ['SNL_PROFILE=long', '256K · Q4_0', 'NONE', `${fmt(LONG.decode, 1)}`, `${LONG.needles_248k?.[1] ?? TBD} AT 248K`],
  ['SNL_PROFILE=stock', 'FIT · F16', 'NONE', `${fmt(ST.decode, 1)}`, 'NOT RUN'],
];
const Flags: React.FC<{theme: Theme}> = ({theme}) => {
  setTheme(theme);
  useFonts();
  const cols = '380px 260px 220px 160px 1fr';
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · SENSENOVA-LOOP-9B · ${STATUS}`} />
      <Hop size={S.m} style={{position: 'absolute', left: 48, top: 128}}>Which profile</Hop>
      <div style={{position: 'absolute', left: 48, right: 48, top: 216}}>
        <div style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32}}>
          <Lab>LAUNCH</Lab><Lab>CONTEXT</Lab><Lab>SPEC</Lab><Lab style={{textAlign: 'right'}}>TOK/S</Lab><Lab style={{textAlign: 'right'}}>NEEDLES</Lab>
        </div>
        <div style={{marginTop: 12, borderTop: `4px solid ${P.ink}`}}>
          {PROFILES().map(([f, win, spec, dec, nd]) => (
            <div key={f} style={{display: 'grid', gridTemplateColumns: cols, columnGap: 32, alignItems: 'center', height: 72, borderBottom: `2px solid ${P.faint}`}}>
              <div style={mono(32, P.cobaltText, 600)}>{f}</div>
              <Px size={S.label}>{win}</Px>
              <Px size={S.label} color={spec === 'NONE' ? P.muted : P.ink}>{spec}</Px>
              <Px size={S.label} style={{textAlign: 'right'}}>{dec}</Px>
              <Px size={S.label} color={P.cobaltText} style={{textAlign: 'right'}}>{nd}</Px>
            </div>
          ))}
        </div>
        <Lab style={{marginTop: 12}}>THINKING OFF · THE Q6_K HAS NO MTP HEAD</Lab>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, top: 628}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{background: P.vermilion, padding: '4px 12px'}}><Px size={S.label} color={P.ink}>DEFAULT</Px></div>
          <Lab color={P.ink}>{`./SERVE.SH · ${fmt(TU.decode_off, 1)} / ${fmt(TU.decode_on, 1)} TOK/S THINKING OFF / ON`}</Lab>
        </div>
        <div style={{marginTop: 16, background: P.sheet, outline: `2px solid ${P.ink}`, padding: '16px 24px'}}>
          <div style={mono(32)}>{'-ngl 99 --fit off -c 131072 -ub 512 -fa on -ctk q8_0 -ctv q8_0'}</div>
          <div style={mono(32)}>{'--spec-type draft-mtp --spec-draft-n-max 2 --jinja --reasoning on'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 48, right: 48, bottom: 32}}>
        <Lab>{`NEEDS PR #${D.engine.pr} · SNL_MMPROJ=AUTO ADDS IMAGES`}</Lab>
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
    ['THINKING OFF', fmt(CTL.off_mean, 1), fmt(TU.decode_off, 1), pct(DER.gain_off_pct)],
    ['THINKING ON', fmt(CTL.on_mean, 1), fmt(TU.decode_on, 1), pct(DER.gain_on_pct)],
    ['PREFILL 8K', fmt(ST.prefill_8k, 0), fmt(TU.prefill_8k, 0), pct(-DER.prefill_cost_pct)],
  ];
  const lim: [string, string][] = [
    ['MTP SPREAD', `PROSE ${fmt(GR.prose_mtp, 1)} VS ${fmt(GR.prose_plain, 1)}`],
    ['LOW SAMPLE', `${fmt(TU.range_on?.[0], 1)} TOK/S THINKING ON`],
    ['GREEDY', `${GR.identical_off}/${GR.n} SAME AS PLAIN`],
    ['LONG 256K', `${LONG.needles_248k?.[1] ?? TBD} AT 248K · ${fmt(LONG.ttft_248k, 0)} S`],
    ['UNCENSORED', `${UNC.answered_by_hand}/${UNC.probe_n} · CODEEVAL ${(UNC.codeeval ?? []).join('/')}`],
    ['KLD', 'NOT MEASURED'],
  ];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Head text={`3060-RECIPES · ${STATUS}`} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 128}}>
        <Hop size={S.l}>{`${MODEL}\non a 12 GB RTX 3060`}</Hop>
        <Lab color={P.cobaltText} style={{marginTop: 24}}>{`${SIZE} LOOPED · MTP N=2 · DECODE TOK/S`}</Lab>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 24}}>
          <Px size={S.xl} color={P.muted}>{fmt(CTL.off_mean, 1)}</Px>
          <Arr size={S.xl} />
          <Sun size={S.xl}>{fmt(TU.decode_off, 1)}</Sun>
        </div>
        <div style={{marginTop: 32, display: 'grid', gridTemplateColumns: cols, columnGap: 24}}>
          <Lab>TOK/S</Lab><Lab style={{textAlign: 'right'}}>PLAIN</Lab><Lab style={{textAlign: 'right'}}>MTP</Lab><Lab style={{textAlign: 'right'}}>GAIN</Lab>
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
            <div key={k} style={{display: 'grid', gridTemplateColumns: '320px 1fr', columnGap: 24, padding: '12px 0', borderBottom: `2px solid ${P.faint}`}}>
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
export {D, DER, Tick};
