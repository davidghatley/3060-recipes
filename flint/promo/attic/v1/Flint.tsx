import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import tlJson from './timeline.json';
import dataJson from './data.json';
import {CHIP, Count, F, Glyph, Mark, P, TypeOn, Words, arrive, carry, cells, label, on, useHouseFonts} from './house';

// Flint on one RTX 3060: launch clip, 1920x1080 at 60 fps. Every time comes from timeline.json;
// every number and log line comes from data.json (tools/prep.py, from ../runs).

/* eslint-disable @typescript-eslint/no-explicit-any */
const tl = tlJson as any;
const D = dataJson as any;
export const FPS: number = tl.fps;
export const FRAMES = Math.round(tl.total * tl.fps);
const M = 48;

// ---------- chrome ----------

export const CHAPTERS: [string, string][] = [['hook', 'TIME TO FIRST TOKEN'], ['box', 'THE BOX'], ['pcie', 'WHERE THE TIME GOES'], ['flags', 'THE FLAGS'], ['kv', 'THE KV CACHE'], ['proof', 'PROOF'], ['try', 'TRY IT']];
const Chrome: React.FC<{t: number}> = ({t}) => {
  const si = CHAPTERS.reduce((acc, [k], i) => (t >= tl[k].in ? i : acc), 0);
  return (
    <>
      <div style={{position: 'absolute', left: M, top: 36, display: 'flex', alignItems: 'center', gap: 16}}>
        <Glyph rows={CHIP} cell={5} />
        <span style={label}><TypeOn text={`3060-RECIPES · PLATE 0${si + 1} · ${CHAPTERS[si][1]}`} t={t} t0={si === 0 ? -1 : tl[CHAPTERS[si][0]].in} /></span>
      </div>
      <div style={{position: 'absolute', right: M, top: 40, display: 'flex', gap: 4}}>
        {CHAPTERS.map((_, i) => <div key={i} style={{width: 16, height: 16, boxSizing: 'border-box', background: i <= si ? P.cobalt : 'transparent', border: i <= si ? 'none' : `2px solid ${P.rule}`}} />)}
      </div>
      <div style={{position: 'absolute', left: M, right: M, top: 80, height: 2, background: P.rule}} />
    </>
  );
};

export const Head: React.FC<{t: number; t0: number; lines: string[]; top?: number; size?: number}> = ({t, t0, lines, top = 112, size = 72}) => (
  <div style={{position: 'absolute', left: M, top, fontFamily: F.text, fontWeight: 700, fontSize: size, lineHeight: `${size + 8}px`, color: P.ink, whiteSpace: 'nowrap'}}>
    {lines.map((s, i) => <div key={i}><Words text={s} t={t} t0={t0 + i * 0.25} /></div>)}
  </div>
);
const Caption: React.FC<{t: number; t0: number; text: string}> = ({t, t0, text}) => (
  <div style={{position: 'absolute', left: M, right: M, bottom: 48, fontFamily: F.serif, fontStyle: 'italic', fontSize: 32, lineHeight: '40px', color: P.muted, opacity: arrive(t, t0)}}>{text}</div>
);
export const Lab: React.FC<{t: number; t0: number; text: string; x: number; y: number; color?: string}> = ({t, t0, text, x, y, color = P.muted}) => (
  <div style={{...label, color, position: 'absolute', left: x, top: y}}><TypeOn text={text} t={t} t0={t0} /></div>
);
export const Pane: React.FC<{x: number; y: number; w: number; h: number; children: React.ReactNode; k?: number}> = ({x, y, w, h, children, k = 1}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, background: P.sheet, outline: `2px solid ${P.ink}`, overflow: 'hidden', clipPath: `inset(0 ${(1 - k) * 100}% 0 0)`}}>{children}</div>
);

// ---------- 01 · hook: the wait before the first token, before and after ----------

const LogPane: React.FC<{t: number; t0: number; y: number; tag: string; line: string; hot?: boolean}> = ({t, t0, y, tag, line, hot}) => {
  const [head, rest] = line.split(' / ');
  return (
    <>
      <Lab t={t} t0={t0} text={tag} x={1000} y={y - 44} />
      <Pane x={1000} y={y} w={872} h={152} k={carry(t, t0, 0.5)}>
        <div style={{padding: '20px 24px', fontFamily: F.mono, fontSize: 20, lineHeight: '36px', color: P.ink, whiteSpace: 'pre'}}>
          <div style={{color: P.muted}}>llama-server · slot print_timing</div>
          <div><TypeOn text={head.replace(/\s+/g, ' ')} t={t} t0={t0 + 0.3} rate={0.012} /></div>
          <div style={{color: hot ? P.cobalt : P.ink, fontWeight: hot ? 600 : 400}}><TypeOn text={'/ ' + rest.replace(/\s+/g, ' ').replace('tokens (', 'tokens  (')} t={t} t0={t0 + 0.8} rate={0.008} /></div>
        </div>
      </Pane>
    </>
  );
};
const Hook: React.FC<{t: number}> = ({t}) => {
  const h = tl.hook;
  return (
    <>
      <Head t={t} t0={h.head} lines={['Flint, a 40B coding model,', 'on one RTX 3060.']} />
      <Lab t={t} t0={h.before} text={`WAIT FOR FIRST TOKEN · ${D.ttft.prompt_tokens.toLocaleString('en-US')}-TOKEN PROMPT`} x={M} y={344} />
      <div style={{position: 'absolute', left: M, top: 400, fontFamily: F.px, fontSize: 120, lineHeight: '120px', color: P.muted, opacity: on(t, h.before) ? 1 : 0}}>
        <Count to={D.ttft.old_s} t={t} t0={h.before} dp={1} />s
      </div>
      <div style={{...label, position: 'absolute', left: M, top: 532, opacity: on(t, h.before) ? 1 : 0}}>BEFORE · STOCK FLAGS</div>
      <div style={{position: 'absolute', left: M, top: 600, fontFamily: F.px, fontSize: 240, lineHeight: '240px', color: P.vermilion, opacity: on(t, h.num) ? 1 : 0}}>
        <Count to={D.ttft.new_s} from={D.ttft.old_s} t={t} t0={h.num} dp={1} dur={0.6} />s
      </div>
      <div style={{...label, color: P.ink, position: 'absolute', left: M, top: 852, opacity: on(t, h.num) ? 1 : 0}}>AFTER · 5 FLAGS CHANGED</div>
      <LogPane t={t} t0={h.before} y={400} tag="BEFORE · REAL SERVER LOG" line={D.ttft.old_line} />
      <LogPane t={t} t0={h.after} y={660} tag="AFTER · REAL SERVER LOG" line={D.ttft.new_line} hot />
      <Caption t={t} t0={h.num + 0.4} text="Same card, same model file, same llama.cpp build. Only the launch flags changed." />
    </>
  );
};

// ---------- 02 · the box: a 23 GB model and a 12 GB card ----------

const Box: React.FC<{t: number}> = ({t}) => {
  const b = tl.box;
  const scale = 1824 / 24;                     // px per GB
  const vram = D.hw.vram_total_mib / 1024 * 1.074; // GB
  const k = carry(t, b.bars, 0.8);
  const gpuPart = D.model.file_gb - D.model.experts_gb * 43 / 47;
  return (
    <>
      <Head t={t} t0={b.in} lines={['The model is twice the size of the GPU.']} />
      <Lab t={t} t0={b.in} text={`FLINT ${D.model.quant} · ${D.model.file_gb} GB FILE`} x={M} y={260} />
      <div style={{position: 'absolute', left: M, top: 304, width: D.model.file_gb * scale * k, height: 96, background: P.ink}} />
      <div style={{position: 'absolute', left: M, top: 304, width: gpuPart * scale * k, height: 96, background: P.cobalt}} />
      <div style={{position: 'absolute', left: M + 24, top: 326, fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '52px', color: P.onCobalt, opacity: on(t, b.ratio) ? 1 : 0, whiteSpace: 'pre'}}>
        {`ON GPU ${gpuPart.toFixed(1)} GB`}
      </div>
      <div style={{position: 'absolute', left: M + gpuPart * scale + 24, top: 326, fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '52px', color: P.sheet, opacity: on(t, b.ratio) ? 1 : 0, whiteSpace: 'pre'}}>
        {`EXPERTS OF 43 LAYERS IN SYSTEM RAM · ${(D.model.experts_gb * 43 / 47).toFixed(1)} GB`}
      </div>
      <Lab t={t} t0={b.bars} text={`RTX 3060 · 12 GB VRAM`} x={M} y={432} />
      <div style={{position: 'absolute', left: M, top: 476, width: vram * scale * k, height: 96, boxSizing: 'border-box', border: `4px solid ${P.cobalt}`}} />
      <div style={{position: 'absolute', left: M, top: 620, right: M, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, opacity: arrive(t, b.ratio)}}>
        {[
          ['TOTAL / ACTIVE', `${D.model.total_b}B / ${D.model.active_b}B`],
          ['EXPERTS', `${D.model.experts}, top ${D.model.top_k}`],
          ['CPU · RAM READ', `${D.hw.cpu} · ${D.hw.ram_gbps} GB/s`],
          ['LINK', D.hw.pcie],
        ].map(([k2, v]) => (
          <div key={k2} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16}}>
            <div style={label}>{k2}</div>
            <div style={{fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '48px', color: P.ink}}>{v}</div>
          </div>
        ))}
      </div>
      <Caption t={t} t0={b.ratio} text="A mixture of experts reads only 6 of 256 experts per token, so the experts can live in RAM and the rest on the GPU." />
    </>
  );
};

// ---------- 03 · where the time goes: experts cross PCIe once per batch ----------

const Trips: React.FC<{t: number; t0: number; n: number; y: number; title: string; sub: string}> = ({t, t0, n, y, title, sub}) => {
  const k = cells(t, t0, n, 0.05);
  return (
    <>
      <div style={{position: 'absolute', left: M, top: y, fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '48px', color: P.ink, opacity: on(t, t0) ? 1 : 0, whiteSpace: 'pre'}}>{title}</div>
      <div style={{...label, position: 'absolute', left: M, top: y + 52, opacity: on(t, t0) ? 1 : 0}}>{sub}</div>
      <div style={{position: 'absolute', left: 560, top: y, display: 'flex', gap: 8}}>
        {Array.from({length: 22}, (_, i) => (
          <div key={i} style={{width: 52, height: 80, boxSizing: 'border-box', background: i < k && i < n ? P.cobalt : 'transparent', border: i < n ? `2px solid ${P.cobalt}` : `2px solid ${P.faint}`, opacity: on(t, t0) ? 1 : 0}} />
        ))}
      </div>
    </>
  );
};
const Pcie: React.FC<{t: number}> = ({t}) => {
  const c = tl.pcie;
  const k = carry(t, c.flow, 0.6);
  const box = (x: number, w: number, title: string, sub: string) => (
    <div style={{position: 'absolute', left: x, top: 290, width: w, height: 150, boxSizing: 'border-box', border: `2px solid ${P.ink}`, background: P.sheet, padding: '20px 24px', opacity: k}}>
      <div style={label}>{title}</div>
      <div style={{fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '48px', color: P.ink, whiteSpace: 'pre'}}>{sub}</div>
    </div>
  );
  return (
    <>
      <Head t={t} t0={c.in} lines={['Every prompt batch ships the experts', 'across PCIe. Bigger batches, fewer trips.']} size={48} />
      {box(M, 560, 'SYSTEM RAM', `experts · ${D.pcie.chunk_gb} GB`)}
      {box(1312, 560, 'RTX 3060', 'matmul on the GPU')}
      <div style={{position: 'absolute', left: 640, top: 362, width: 640 * k, height: 6, background: P.cobalt}} />
      <div style={{...label, position: 'absolute', left: 660, top: 312, opacity: k}}>{`${D.hw.pcie} · ~${D.pcie.peak_gbps} GB/S`}</div>
      <Trips t={t} t0={c.t512} n={D.pcie.trips_512} y={500} title="-ub 512" sub={`${D.pcie.trips_512} TRIPS · 11K PROMPT`} />
      <Trips t={t} t0={c.t4096} n={D.pcie.trips_4096} y={680} title="-ub 4096" sub={`${D.pcie.trips_4096} TRIPS · 11K PROMPT`} />
      <Caption t={t} t0={c.t4096 + 0.4} text={`Each trip moves ${D.pcie.chunk_gb} GB at about ${D.pcie.peak_gbps} GB/s. The old default paid that toll every 512 tokens.`} />
    </>
  );
};

// ---------- 04 · the flags: prefill climbing, the serve script changing ----------

const Flags: React.FC<{t: number}> = ({t}) => {
  const f = tl.flags;
  const steps = D.prefill_steps as {label: string; tps: number}[];
  const max = 2000;
  const oldSet = new Set(D.flags_old as string[]);
  return (
    <>
      <Head t={t} t0={f.in} lines={['Bigger batches and no mmap:', 'prompts 5× faster.']} />
      <Lab t={t} t0={f.bars} text="PREFILL TOK/S · 4K PROMPT · LLAMA-BENCH" x={M} y={300} />
      {steps.map((s, i) => {
        const t0 = f.bars + i * 0.3;
        const k = arrive(t, t0, 0.5);
        const y = 348 + i * 100;
        const last = i === steps.length - 1;
        return (
          <React.Fragment key={s.label}>
            <div style={{position: 'absolute', left: M, top: y, width: 300, fontFamily: F.mono, fontSize: 25, lineHeight: '72px', color: P.ink, whiteSpace: 'pre', opacity: on(t, t0) ? 1 : 0}}>{s.label}</div>
            <div style={{position: 'absolute', left: 360, top: y, width: (s.tps / max) * 520 * k, height: 72, background: last ? P.cobalt : i === 0 ? P.rule : P.tint}} />
            <div style={{position: 'absolute', left: 360 + (s.tps / max) * 520 * k + 16, top: y, fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '72px', color: P.ink, opacity: on(t, t0) ? 1 : 0}}>
              <Count to={s.tps} t={t} t0={t0} dur={0.5} />
            </div>
          </React.Fragment>
        );
      })}
      <Lab t={t} t0={f.cmd} text="SERVE.SH · LLAMA-SERVER FLAGS" x={1100} y={300} />
      <Pane x={1100} y={348} w={772} h={480} k={carry(t, f.cmd, 0.5)}>
        <div style={{paddingTop: 20}}>
          {(D.flags_new as string[]).map((line, i) => {
            const changed = !oldSet.has(line);
            const lit = changed && on(t, f.done);
            return (
              <div key={i} style={{height: 88, display: 'flex', alignItems: 'center', padding: '0 24px', background: lit ? P.tint : 'transparent', boxShadow: lit ? `inset 6px 0 0 ${P.cobalt}` : 'none', fontFamily: F.mono, fontSize: 20, lineHeight: '36px', color: lit ? P.cobalt : P.ink, fontWeight: lit ? 600 : 400, whiteSpace: 'pre'}}>
                <TypeOn text={line} t={t} t0={f.cmd + 0.3 + i * 0.25} rate={0.01} />
              </div>
            );
          })}
        </div>
      </Pane>
      <Caption t={t} t0={f.done} text="Stock llama.cpp b12242. No patches, no custom kernels: only the flags in cobalt changed." />
    </>
  );
};

// ---------- 05 · the KV cache: f16 beats q8_0 on this model ----------

const Kv: React.FC<{t: number}> = ({t}) => {
  const v = tl.kv;
  const rows: [string, number, boolean][] = [['q8_0 KV · 32k context', D.kv.q8_32k, false], ['f16 KV · 32k context', D.kv.f16_32k, true], ['q8_0 KV · empty', D.kv.q8_0, false], ['f16 KV · empty', D.kv.f16_0, false]];
  const gain = Math.round((D.kv.f16_32k / D.kv.q8_32k - 1) * 100);
  return (
    <>
      <Head t={t} t0={v.in} lines={[`Quantized KV was the slow path.`, `f16 decodes ${gain}% faster at 32k.`]} />
      <Lab t={t} t0={v.bars} text="DECODE TOK/S · LLAMA-BENCH · 4 REPS" x={M} y={300} />
      {rows.map(([name, val, hot], i) => {
        const t0 = v.bars + i * 0.25;
        const k = arrive(t, t0, 0.5);
        const y = 348 + i * 100 + (i >= 2 ? 40 : 0);
        return (
          <React.Fragment key={name}>
            <div style={{position: 'absolute', left: M, top: y, width: 420, fontFamily: F.mono, fontSize: 25, lineHeight: '72px', color: P.ink, whiteSpace: 'pre', opacity: on(t, t0) ? 1 : 0}}>{name}</div>
            <div style={{position: 'absolute', left: 480, top: y, width: (val / 60) * 760 * k, height: 72, background: hot ? P.cobalt : i >= 2 ? P.faint : P.rule}} />
            <div style={{position: 'absolute', left: 480 + (val / 60) * 760 * k + 16, top: y, fontFamily: F.mono, fontWeight: 600, fontSize: 32, lineHeight: '72px', color: P.ink, opacity: on(t, t0) ? 1 : 0}}>{val.toFixed(1)}</div>
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: 1440, top: 348, width: 432, opacity: arrive(t, v.why)}}>
        <div style={{...label, color: P.ink}}>WHY</div>
        <div style={{fontFamily: F.text, fontSize: 32, lineHeight: '40px', color: P.ink, marginTop: 12}}>
          Only {D.model.full_attn_layers} of {D.model.layers} layers keep a full-length KV cache. The rest use a 513-token window, so f16 at 128k costs 3.5 GB.
        </div>
      </div>
      <Caption t={t} t0={v.why} text="The tip came from 0xSero's inference-optimisation notes: quantized KV is slow on models with few KV layers." />
    </>
  );
};

// ---------- 06 · proof: long context still works ----------

const Proof: React.FC<{t: number}> = ({t}) => {
  const p = tl.proof;
  const tiles: [number, string, string, string][] = [
    [p.n60, 'NEEDLES · 60K PROMPT', D.needles.k60, '3 random codes, found exactly'],
    [p.n120, 'NEEDLES · 120K PROMPT', D.needles.k120, `${D.needles.prompt_120k.toLocaleString('en-US')} tokens at ${Math.round(D.needles.prefill_120k).toLocaleString('en-US')} tok/s`],
    [p.n120 + 0.3, 'VRAM IN USE', (D.needles.vram_mib / 1024).toFixed(1), 'GB of 12 GB, at 128k context'],
    [p.spec, 'DECODE · PROSE / CODE', `${Math.round(D.decode.new_prose)}`, `tok/s; up to ${Math.round(D.decode.spec_best)} when the model copies code`],
  ];
  return (
    <>
      <Head t={t} t0={p.in} lines={['128k context, and it still', 'finds every needle.']} />
      <div style={{position: 'absolute', left: M, right: M, top: 330, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24}}>
        {tiles.map(([t0, k2, v, s]) => (
          <div key={k2} style={{borderTop: `4px solid ${P.cobalt}`, paddingTop: 20, opacity: on(t, t0) ? 1 : 0}}>
            <div style={label}>{k2}</div>
            <div style={{fontFamily: F.px, fontSize: 120, lineHeight: '160px', color: P.ink}}>{v}</div>
            <div style={{fontFamily: F.text, fontSize: 25, lineHeight: '32px', color: P.muted}}>{s}</div>
          </div>
        ))}
      </div>
      <Caption t={t} t0={p.spec + 0.3} text="Every speed above was checked against a control run before and after. Medians, server-side token counts." />
    </>
  );
};

// ---------- 07 · try it: the command and the credits ----------

const Try: React.FC<{t: number}> = ({t}) => {
  const y = tl.try;
  const cmd = ['llama-server -m Flint-Q4_K_M.gguf -ngl 99 -ncmoe 43', '  -c 131072 -b 4096 -ub 4096 --load-mode none', '  -fa on -ctk f16 -ctv f16 -t 6 --jinja', '  --spec-type ngram-map-k'];
  const credits: [string, string][] = [['MODEL', 'Flint · Recursive'], ['ENGINE + GGUF', 'llama.cpp · ggml-org'], ['METHOD', 'inference-optimisation · 0xSero']];
  return (
    <>
      <Head t={t} t0={y.in} lines={['Try it on your 12 GB card.']} />
      <Pane x={M} y={240} w={1824} h={260} k={carry(t, y.cmd, 0.5)}>
        <div style={{padding: '24px 32px', fontFamily: F.mono, fontSize: 32, lineHeight: '52px', color: P.ink, whiteSpace: 'pre'}}>
          {cmd.map((l, i) => <div key={i}><TypeOn text={l} t={t} t0={y.cmd + 0.2 + i * 0.25} rate={0.008} /></div>)}
        </div>
      </Pane>
      <div style={{position: 'absolute', left: M, top: 560, display: 'grid', gridTemplateColumns: 'repeat(3, 560px)', gap: 72}}>
        {credits.map(([k2, v], i) => (
          <div key={k2} style={{borderTop: `2px solid ${P.ink}`, paddingTop: 16, opacity: on(t, y.credits + i * 0.2) ? 1 : 0}}>
            <div style={label}>{k2}</div>
            <div style={{fontFamily: F.text, fontWeight: 700, fontSize: 32, lineHeight: '48px', color: P.ink}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: M, top: 760, fontFamily: F.mono, fontWeight: 600, fontSize: 48, lineHeight: '64px', color: P.cobalt, opacity: arrive(t, y.credits + 0.8)}}>github.com/davidghatley/3060-recipes</div>
      <div style={{position: 'absolute', right: M, bottom: 48, display: 'flex', alignItems: 'center', gap: 20, opacity: arrive(t, y.credits + 1.2)}}>
        <Mark cell={8} />
        <div>
          <div style={{fontFamily: F.text, fontWeight: 700, fontSize: 32, lineHeight: '40px', color: P.ink}}>David Hatley</div>
          <div style={{fontFamily: F.text, fontSize: 20, lineHeight: '24px', color: P.muted}}>design · AI/ML · generative tools</div>
        </div>
      </div>
    </>
  );
};

// ---------- composition ----------

const SCENES: [string, React.FC<{t: number}>][] = [['hook', Hook], ['box', Box], ['pcie', Pcie], ['flags', Flags], ['kv', Kv], ['proof', Proof], ['try', Try]];
export const FlintLaunch: React.FC = () => {
  useHouseFonts();
  const t = useCurrentFrame() / FPS;
  const idx = SCENES.reduce((acc, [k], i) => (t >= tl[k].in ? i : acc), 0);
  const Scene = SCENES[idx][1];
  return (
    <AbsoluteFill style={{background: P.paper}}>
      <Chrome t={t} />
      <Scene t={t} />
    </AbsoluteFill>
  );
};
