import React from 'react';
import {AbsoluteFill} from 'remotion';
import dataJson from './data.json';
import {CHIP, F, Glyph, P, label, useHouseFonts} from './house';

// Thread stills, 1600x900 (16:9, uncropped as a single image on X). Numbers from data.json.

/* eslint-disable @typescript-eslint/no-explicit-any */
const D = dataJson as any;
const M = 48;

const Frame: React.FC<{plate: string; title: string; caption: string; children: React.ReactNode}> = ({plate, title, caption, children}) => {
  useHouseFonts();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', left: M, top: 36, display: 'flex', alignItems: 'center', gap: 16}}>
        <Glyph rows={CHIP} cell={5} />
        <span style={label}>{`3060-RECIPES · ${plate} · ${title}`}</span>
      </div>
      <div style={{position: 'absolute', left: M, right: M, top: 80, height: 2, background: P.rule}} />
      {children}
      <div style={{position: 'absolute', left: M, right: M, bottom: 40, fontFamily: F.serif, fontStyle: 'italic', fontSize: 25, lineHeight: '32px', color: P.muted}}>{caption}</div>
    </AbsoluteFill>
  );
};

const cell = (s: string, o: React.CSSProperties = {}) => <div style={{fontFamily: F.mono, fontSize: 25, lineHeight: '32px', color: P.ink, padding: '16px 0', borderBottom: `2px solid ${P.faint}`, whiteSpace: 'pre', ...o}}>{s}</div>;

export const ThreadResults: React.FC = () => {
  const rows: [string, string, string][] = [
    ['Wait for first token, 11k prompt', `${D.ttft.old_s} s`, `${D.ttft.new_s} s`],
    ['Prefill, 11k prompt', `${D.ttft.old_tps} tok/s`, `${D.ttft.new_tps.toLocaleString('en-US')} tok/s`],
    ['Decode, prose', `${D.decode.old_prose} tok/s`, `${D.decode.new_prose} tok/s`],
    ['Decode at 32k context', `${D.kv.q8_32k.toFixed(1)} tok/s`, `${D.kv.f16_32k} tok/s`],
    ['Needles at 60k / 120k', 'not run', `${D.needles.k60} · ${D.needles.k120}`],
    ['VRAM in use, 128k context', `${(D.needles.vram_old_mib / 1024).toFixed(1)} GB`, `${(D.needles.vram_mib / 1024).toFixed(1)} GB of 12`],
  ];
  return (
    <Frame plate="PLATE R.1" title="RESULTS" caption={`RTX 3060 12 GB · i5-12500 · 62 GB DDR5 · llama.cpp ${D.engine.build}, unpatched. Medians of 3–6 runs, server-side token counts.`}>
      <div style={{position: 'absolute', left: M, top: 112, fontFamily: F.text, fontWeight: 700, fontSize: 48, lineHeight: '56px', color: P.ink}}>Flint Q4_K_M on one RTX 3060, before and after</div>
      <div style={{position: 'absolute', left: M, right: M, top: 220, display: 'grid', gridTemplateColumns: '1fr 360px 360px'}}>
        <div style={{...label, paddingBottom: 12, borderBottom: `2px solid ${P.ink}`}}>{' '}</div>
        <div style={{...label, paddingBottom: 12, borderBottom: `2px solid ${P.ink}`}}>STOCK FLAGS</div>
        <div style={{...label, color: P.cobalt, paddingBottom: 12, borderBottom: `2px solid ${P.ink}`}}>TUNED</div>
        {rows.map(([a, b, c], i) => (
          <React.Fragment key={a}>
            {cell(a, {fontFamily: F.text})}
            {cell(b, {color: P.muted})}
            {cell(c, {color: i === 0 ? P.vermilion : P.cobalt, fontWeight: 600})}
          </React.Fragment>
        ))}
      </div>
    </Frame>
  );
};

export const ThreadFlags: React.FC = () => {
  const rows: [string, string, string][] = [
    ['-b 4096 -ub 4096', '4.1× prefill', 'experts cross PCIe once per batch, not every 512 tokens'],
    ['--load-mode none', '+24% prefill', 'weights read into RAM instead of mmap'],
    ['-ctk f16 -ctv f16', '+29% decode @ 32k', `only ${D.model.full_attn_layers} of ${D.model.layers} layers keep full KV`],
    ['-ncmoe 43', '+4% decode', '4 layers of experts into the VRAM left over'],
    ['--spec-type ngram-map-k', `${Math.round(D.decode.new_code)}–${Math.round(D.decode.spec_best)} tok/s`, 'helps only when the output repeats the prompt'],
    ['-t 6', 'kept', `RAM read peaks at ${D.hw.ram_gbps} GB/s with 6 threads`],
  ];
  return (
    <Frame plate="PLATE R.2" title="THE FLAGS" caption="Each change was tested alone between two control runs. Log of everything tried, including what did not help: flint/PLAN.md.">
      <div style={{position: 'absolute', left: M, top: 112, fontFamily: F.text, fontWeight: 700, fontSize: 48, lineHeight: '56px', color: P.ink}}>Five flags, no kernel patches</div>
      <div style={{position: 'absolute', left: M, right: M, top: 220, display: 'grid', gridTemplateColumns: '480px 320px 1fr'}}>
        {['FLAG', 'GAIN', 'WHY'].map((h) => <div key={h} style={{...label, paddingBottom: 12, borderBottom: `2px solid ${P.ink}`}}>{h}</div>)}
        {rows.map(([a, b, c]) => (
          <React.Fragment key={a}>
            {cell(a, {color: P.cobalt, fontWeight: 600})}
            {cell(b, {fontWeight: 600})}
            {cell(c, {fontFamily: F.text, color: P.muted})}
          </React.Fragment>
        ))}
      </div>
    </Frame>
  );
};
