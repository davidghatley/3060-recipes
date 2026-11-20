// Render the build-up of a generated three.js page, headless on the CPU (SwiftShader), never the GPU.
//   node buildseq.mjs page.html out_dir [W H]
// Writes out_dir/meta.json {lines: [requiredLine per mesh, in add order], total_lines, errors}
// and out_dir/s<k>.png = the scene with the k earliest-required meshes visible (k over a set of levels).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const HERE = dirname(fileURLToPath(import.meta.url));
const [page, outDir, W = "960", H = "1080"] = process.argv.slice(2);
const LEVELS = +(process.env.LEVELS || 96), SETTLE = +(process.env.SETTLE_MS || 2500);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = mkdtempSync(join(tmpdir(), "qc-build-"));
const html = readFileSync(page, "utf8").replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/0\.160\.0\/three\.module\.min\.js/g, "./three-wrap.mjs");
writeFileSync(join(srv, "page.html"), html);
for (const f of ["three-wrap.mjs", "three.module.min.js"]) copyFileSync(join(HERE, f), join(srv, f));
const server = http.createServer((q, s) => {
  const p = join(srv, decodeURIComponent(q.url.split("?")[0]));
  if (!existsSync(p)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": p.endsWith(".html") ? "text/html" : "text/javascript" });
  s.end(readFileSync(p));
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const port = server.address().port;

// Virtual clock: time only moves when we step it.
const HOOK = `(() => {
  let vt = 0; const q = []; window.__errs = [];
  performance.now = () => vt; const D0 = 1.7e12; Date.now = () => D0 + vt;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => { vt += ms; for (const cb of q.splice(0)) { try { cb(vt); } catch (e) { __errs.push(String(e)); } } };
  window.__level = (k) => { const a = window.__adds || []; a.forEach((r, i) => { r.o.visible = i < k ? r.vis : false; }); };
  addEventListener('error', (e) => __errs.push(String(e.message)), true);
})();`;

const prof = mkdtempSync(join(tmpdir(), "qc-chrome-"));
const proc = spawn(process.env.CHROME || "/usr/bin/chromium", [
  "--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--no-first-run", "--mute-audio", "--hide-scrollbars", `--window-size=${W},${H}`,
  "--remote-debugging-port=0", `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
try {
  const portFile = join(prof, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
  const [cport] = readFileSync(portFile, "utf8").split("\n");
  const targets = await (await fetch(`http://127.0.0.1:${cport}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || { error: m.error }); pend.delete(m.id); } };
  const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/page.html` });
  for (let i = 0; i < 100 && !(await ev("!!(window.__adds && window.__adds.length) && document.readyState==='complete'")); i++) await sleep(100);
  await sleep(500);
  // Let the scene settle (intro animations) on the virtual clock.
  for (let t = 0; t < SETTLE; t += 50) await ev("__step(50)");
  const lines = await ev("__adds.map(r => r.line)");
  const n = lines.length;
  // Meshes appear in order of the line they need; build levels follow that order.
  const order = await ev(`(() => { const a = __adds.map((r, i) => [r.line, i]); a.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    window.__adds = a.map(([, i]) => __adds[i]); return a.map(([l]) => l); })()`);
  const ks = [...new Set(Array.from({ length: LEVELS + 1 }, (_, j) => Math.round((j / LEVELS) * n)))];
  for (const k of ks) {
    await ev(`__level(${k}); __step(16)`);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(outDir, `s${k}.png`), Buffer.from(shot.data, "base64"));
  }
  const errs = await ev("__errs");
  writeFileSync(join(outDir, "meta.json"), JSON.stringify({ n, levels: ks, lines: order, total_lines: html.split("\n").length, errors: errs }, null, 1));
  console.log(`${page}: ${n} meshes, ${ks.length} levels, errors=${errs.length}, line range ${order[0]}..${order[n - 1]}`);
  ws.close();
} finally { proc.kill(); server.close(); }
