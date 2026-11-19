import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CHIP, Glyph} from '../house';
import {Arr, D, setTheme, type Theme, HW1, HW2, Lab, M, P, Px, S, fmt, mono, pct, times, useFonts3, useV} from './kit';

// Thread stills, v3: 1600x900 (16:9) and 1080x1440 (3:4). Stem 7 for every number and word; Plex Mono for the flags.

const MODEL = `Flint 40B-A${D.model.active_b}B`;
const Frame: React.FC<{plate: string; title: string; children: React.ReactNode}> = ({plate, title, children}) => {
  useFonts3();
  const v = useV();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', left: M, top: 32, display: 'flex', alignItems: 'center', gap: 16, height: 32}}>
        <Glyph rows={CHIP} cell={6} color={P.cobalt} />
        <Lab>{`3060-RECIPES · ${plate}`}</Lab>
      </div>
      <div style={{position: 'absolute', left: M, right: M, top: 96, height: 2, background: P.rule}} />
      <div style={{position: 'absolute', left: M, right: M, top: 136, bottom: v ? 184 : 104, display: 'flex', flexDirection: 'column'}}>
        <Px size={S.l} style={{whiteSpace: 'pre', lineHeight: '88px', marginBottom: 24}}>{title}</Px>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 0}}>{children}</div>
      </div>
      <div style={{position: 'absolute', left: M, right: M, bottom: 32, borderTop: `2px solid ${P.rule}`, paddingTop: 16}}>
        {v ? <><Lab>{HW1}</Lab><Lab style={{marginTop: 8}}>{HW2}</Lab></> : <Lab>{`${HW1} · ${HW2.replace(' · NO PATCHES', '')}`}</Lab>}
      </div>
    </AbsoluteFill>
  );
};

export const ThreadResults3: React.FC<{theme?: Theme}> = ({theme = 'light'}) => {
  setTheme(theme);
  const v = useV();
  const ppLast = D.prefill_steps[D.prefill_steps.length - 1].tps;
  const pp0 = D.prefill_steps[0].tps;
  const rows: [string, string, string, string][] = [
    ['pp 11k', fmt(D.ttft.old_tps), fmt(D.ttft.new_tps), times(D.ttft.old_tps, D.ttft.new_tps)],
    ['tg', fmt(D.decode.old_prose, 1), fmt(D.decode.new_prose, 1), pct(D.decode.old_prose, D.decode.new_prose)],
    ['tg @ 32k', fmt(D.kv.q8_32k, 1), fmt(D.decode.new_32k, 1), pct(D.kv.q8_32k, D.decode.new_32k)],
    ['TTFT 11k · s', `${D.ttft.old_s}`, `${D.ttft.new_s}`, `${(D.ttft.old_s / D.ttft.new_s).toFixed(1)}×`],
    ['NIAH 60k 120k', '–', `${D.needles.k60} ${D.needles.k120}`, ''],
    ['VRAM 128k · GiB', (D.needles.vram_old_mib / 1024).toFixed(1), (D.needles.vram_mib / 1024).toFixed(1), ''],
  ];
  const size = S.m;
  const rowPad = v ? 22 : 4;
  const cell = (s: string, color: string, i: number, right = true, sz: number = size): React.ReactNode => (
    <div style={{padding: `${rowPad}px 0`, borderBottom: `2px solid ${P.faint}`, textAlign: right ? 'right' : 'left'}}>
      <Px size={sz} color={color}>{s}</Px>
      {void i}
    </div>
  );
  const head = (s: string, color: string = P.muted, right = true) => <div style={{paddingBottom: 12, borderBottom: `2px solid ${P.ink}`, textAlign: right ? 'right' : 'left'}}><Lab color={color}>{s || ' '}</Lab></div>;
  return (
    <Frame plate="R.1 · RESULTS" title={v ? `${MODEL}\non a 12 GB\nRTX 3060\nQ4_K_M` : `${MODEL}\non a 12 GB RTX 3060 · Q4_K_M`}>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr max-content 48px max-content max-content' : '1fr 240px 64px 240px 240px', columnGap: 24}}>
        {head('', P.muted, false)}{head('STOCK')}{head('')}{head('TUNED', P.cobaltText)}{head('Δ')}
        {rows.map(([a, b, x, d], i) => (
          <React.Fragment key={a}>
            {cell(a, P.ink, i, false, v ? S.label : size)}
            {cell(b, P.muted, i)}
            {<div style={{padding: `${rowPad}px 0`, borderBottom: `2px solid ${P.faint}`, textAlign: 'center'}}>{b !== '–' && <Arr size={size} />}</div>}
            {cell(x, P.ink, i)}
            {cell(d, i === 0 ? P.vermilion : P.cobalt, i)}
          </React.Fragment>
        ))}
      </div>
    </Frame>
  );
};

export const ThreadFlags3: React.FC<{theme?: Theme}> = ({theme = 'light'}) => {
  setTheme(theme);
  const v = useV();
  const rows: [string, string, string][] = [
    ['-b 4096 -ub 4096', 'pp 4.1×', `PCIe expert copies ${D.pcie.trips_512} → ${D.pcie.trips_4096} per 11k prompt`],
    ['--load-mode none', 'pp +24%', 'no mmap'],
    ['-ctk f16 -ctv f16', 'tg @ 32k +29%', `${D.model.full_attn_layers}/${D.model.layers} full attn, rest SWA`],
    ['--moe-cache-mib 2944', `tg +${D.cache.tg_gain_pct}%`, 'hot experts cached in VRAM'],
    ['--spec-type ngram-map-k', `tg ${Math.round(D.decode.new_code)}–${Math.round(D.decode.spec_best)}`, 'code and repetitive output only'],
    ['-t 6', 'kept', `DDR5 read saturates at ${D.hw.ram_gbps} GB/s`],
  ];
  return (
    <Frame plate="R.2 · FLAGS" title={v ? 'Five flags.\nStock llama.cpp,\nno patches.' : 'Five flags. No patches.'}>
      <div style={{borderTop: `2px solid ${P.ink}`, ...(v ? {} : {flex: 1, display: 'flex', flexDirection: 'column'})}}>
        {rows.map(([a, b, w], i) => (
          <div key={a} style={{display: 'grid', gridTemplateColumns: v ? '1fr max-content' : '444px 404px 1fr', columnGap: 24, rowGap: 12, alignItems: 'center', padding: v ? '16px 0' : '6px 0', borderBottom: `2px solid ${P.faint}`, ...(v ? {} : {flex: 1})}}>
            <div style={mono(32, P.cobaltText, 600)}>{a}</div>
            <Px size={S.m} color={i === 0 ? P.vermilion : P.ink} style={{justifySelf: v ? 'end' : 'start'}}>{b}</Px>
            <Px size={S.label} color={P.muted} style={{whiteSpace: 'normal', lineHeight: '40px', gridColumn: v ? '1 / -1' : undefined}}>{w}</Px>
          </div>
        ))}
      </div>
    </Frame>
  );
};
export const ThreadResults3Dark: React.FC = () => <ThreadResults3 theme="dark" />;
export const ThreadFlags3Dark: React.FC = () => <ThreadFlags3 theme="dark" />;
