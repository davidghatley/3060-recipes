import React from 'react';
import {AbsoluteFill} from 'remotion';
import dataJson from './data.json';
import {CHIP, F, Glyph, P, label, useHouseFonts} from './house';
import {HW, LAB, MODEL, useV} from './Flint';

// Thread stills: 1600x900 (16:9) and 1080x1440 (3:4, the tallest a single image shows uncropped). Numbers from data.json.
// Type one house step up from the docs scale: labels 32, table text 32, notes 25, titles 72.

/* eslint-disable @typescript-eslint/no-explicit-any */
const D = dataJson as any;
const M = 48;
const fmt = (n: number, dp = 0) => n.toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp});

const Frame: React.FC<{plate: string; title: string; children: React.ReactNode}> = ({plate, title, children}) => {
  useHouseFonts();
  const v = useV();
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <div style={{position: 'absolute', left: M, top: 36, display: 'flex', alignItems: 'center', gap: 16}}>
        <Glyph rows={CHIP} cell={6} />
        <span style={LAB}>{`3060-RECIPES · ${plate}`}</span>
      </div>
      <div style={{position: 'absolute', left: M, right: M, top: 96, height: 2, background: P.rule}} />
      <div style={{position: 'absolute', left: M, right: M, top: 128, bottom: v ? 136 : 112, display: 'flex', flexDirection: 'column', gap: v ? 56 : 32}}>
        <div style={{fontFamily: F.text, fontWeight: 700, fontSize: 72, lineHeight: '80px', color: P.ink, textWrap: 'balance'} as React.CSSProperties}>{title}</div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: v ? 'center' : 'flex-start'}}>{children}</div>
      </div>
      <div style={{position: 'absolute', left: M, right: M, bottom: 36, borderTop: `2px solid ${P.rule}`, paddingTop: 12}}>
        <span style={{...label, fontSize: 25, lineHeight: '32px', letterSpacing: '2px'}}>{HW}</span>
      </div>
    </AbsoluteFill>
  );
};
const c = (s: string, o: React.CSSProperties = {}) => <div style={{fontFamily: F.mono, fontSize: 32, lineHeight: '40px', color: P.ink, padding: '6px 0', borderBottom: `2px solid ${P.faint}`, whiteSpace: 'pre', ...o}}>{s}</div>;
const head = (s: string, color = P.muted) => <div style={{...LAB, color, paddingBottom: 12, borderBottom: `2px solid ${P.ink}`}}>{s || ' '}</div>;

export const ThreadResults: React.FC = () => {
  const v = useV();
  const pad: React.CSSProperties = v ? {padding: '28px 0'} : {};
  const pct = (a: number, b: number) => `+${Math.round((b / a - 1) * 100)}%`;
  const ppLast = D.prefill_steps[D.prefill_steps.length - 1].tps;
  const rows: [string, string, string, string][] = [
    ['pp 11k', fmt(D.ttft.old_tps), fmt(D.ttft.new_tps), `${(D.ttft.new_tps / D.ttft.old_tps).toFixed(1)}×`],
    ['pp4096', fmt(D.prefill_steps[0].tps), fmt(ppLast), `${(ppLast / D.prefill_steps[0].tps).toFixed(1)}×`],
    ['tg', fmt(D.decode.old_prose, 1), fmt(D.decode.new_prose, 1), pct(D.decode.old_prose, D.decode.new_prose)],
    ['tg @ 32k', fmt(D.kv.q8_32k, 1), fmt(D.kv.f16_32k, 1), pct(D.kv.q8_32k, D.kv.f16_32k)],
    ['TTFT 11k', `${D.ttft.old_s} s`, `${D.ttft.new_s} s`, `${(D.ttft.old_s / D.ttft.new_s).toFixed(1)}×`],
    ['NIAH 60k/120k', '–', `${D.needles.k60} ${D.needles.k120}`, ''],
    ['VRAM @ 128k', `${(D.needles.vram_old_mib / 1024).toFixed(1)} GiB`, `${(D.needles.vram_mib / 1024).toFixed(1)} GiB`, ''],
  ];
  return (
    <Frame plate="R.1 · RESULTS" title={`${MODEL} Q4_K_M on a 12 GB RTX 3060`}>
      <div style={{display: 'grid', gridTemplateColumns: v ? '1fr 210px 210px 130px' : '1fr 320px 320px 200px'}}>
        {head('')}{head('STOCK')}{head('TUNED', P.cobalt)}{head('Δ')}
        {rows.map(([a, b, x, d], i) => (
          <React.Fragment key={a}>
            {c(a, pad)}{c(b, {...pad, color: P.muted})}{c(x, {...pad, color: P.cobalt, fontWeight: 600})}{c(d, {...pad, fontWeight: 600, color: i === 0 ? P.vermilion : P.ink})}
          </React.Fragment>
        ))}
      </div>
    </Frame>
  );
};

export const ThreadFlags: React.FC = () => {
  const v = useV();
  const rows: [string, string, string][] = [
    ['-b 4096 -ub 4096', 'pp 4.1×', 'ubatch PCIe expert copies 22 → 3 per 11k prompt'],
    ['--load-mode none', 'pp +24%', 'no mmap'],
    ['-ctk f16 -ctv f16', 'tg @ 32k +29%', `${D.model.full_attn_layers}/${D.model.layers} full-attn, rest SWA 513; 3.5 GiB @ 128k`],
    ['-ncmoe 43', 'tg +4%', 'was 47; fills VRAM left after KV'],
    ['--spec-type ngram-map-k', `tg ${Math.round(D.decode.new_code)}–${Math.round(D.decode.spec_best)}`, 'code / repetitive output only'],
    ['-t 6', 'kept', `DDR5 read saturates at ${D.hw.ram_gbps} GB/s`],
  ];
  return (
    <Frame plate="R.2 · FLAGS" title="Five flags. Stock llama.cpp, no patches.">
      {v ? (
        <div style={{borderTop: `2px solid ${P.ink}`}}>
          {rows.map(([a, b, w]) => (
            <div key={a} style={{padding: '24px 0', borderBottom: `2px solid ${P.faint}`}}>
              <div style={{display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: F.mono, fontSize: 32, lineHeight: '40px', whiteSpace: 'pre'}}>
                <span style={{color: P.cobalt, fontWeight: 600}}>{a}</span><span style={{color: P.ink, fontWeight: 600}}>{b}</span>
              </div>
              <div style={{fontFamily: F.mono, fontSize: 25, lineHeight: '32px', color: P.muted, marginTop: 8}}>{w}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: '500px 300px 1fr', alignItems: 'stretch'}}>
          {head('FLAG')}{head('GAIN')}{head('NOTE')}
          {rows.map(([a, b, w]) => (
            <React.Fragment key={a}>
              {c(a, {color: P.cobalt, fontWeight: 600})}{c(b, {fontWeight: 600})}{c(w, {color: P.muted, fontSize: 25, lineHeight: '40px', whiteSpace: 'normal'})}
            </React.Fragment>
          ))}
        </div>
      )}
    </Frame>
  );
};
