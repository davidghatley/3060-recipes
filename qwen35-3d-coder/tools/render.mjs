// Render generated three.js pages headless in chromium on the CPU (SwiftShader), never the GPU.
//   node tools/render.mjs <out_dir> page1.html [page2.html ...]
// For each page writes <out_dir>/<name>.json (errors, WebGL use, frame count) and two screenshots
// <name>.a.png (t=SHOT_A ms) and <name>.b.png (t=SHOT_B ms). Blankness is scored later by tools/score.py.
// No npm deps: talks to chromium over the DevTools protocol with Node's built-in WebSocket.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const [outDir, ...pages] = process.argv.slice(2);
const SHOT_A = +(process.env.SHOT_A || 3000), SHOT_B = +(process.env.SHOT_B || 6000);
const CHROME = process.env.CHROME || "/usr/bin/chromium";
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Injected before any page script: count WebGL contexts and rAF callbacks, catch errors.
const HOOK = `(() => {
  const s = window.__qc = { webgl: 0, raf: 0, errors: [], rejections: [] };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    const c = gc.call(this, t, o); if (c && /webgl/.test(t)) s.webgl++; return c; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { s.raf++; return cb(t); });
  window.addEventListener('error', (e) => s.errors.push(String(e.message || e.type).slice(0, 300)), true);
  window.addEventListener('unhandledrejection', (e) => s.rejections.push(String(e.reason).slice(0, 300)));
})();`;

async function renderOne(page) {
  const name = basename(page).replace(/\.html?$/, "");
  const prof = mkdtempSync(join(tmpdir(), "qc-chrome-"));
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars",
    "--window-size=1280,720", "--remote-debugging-port=0", `--user-data-dir=${prof}`, "about:blank",
  ], { stdio: "ignore" });
  const res = { page: resolve(page), name, exceptions: [], console_errors: [], net_errors: [], ok: false };
  try {
    const portFile = join(prof, "DevToolsActivePort");
    for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
    const [port] = readFileSync(portFile, "utf8").split("\n");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || { error: m.error }); pending.delete(m.id); return; }
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails;
        res.exceptions.push(String(d.exception?.description || d.text).split("\n")[0].slice(0, 300));
      } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        res.console_errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
      } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
        res.net_errors.push(`${m.params.entry.text} ${m.params.entry.url || ""}`.slice(0, 300));
      }
    };
    await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
    const t0 = Date.now();
    await send("Page.navigate", { url: "file://" + resolve(page) });
    const shot = async (ms, suffix) => {
      await sleep(Math.max(0, ms - (Date.now() - t0)));
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(outDir, `${name}.${suffix}.png`), Buffer.from(data, "base64"));
    };
    await shot(SHOT_A, "a");
    await shot(SHOT_B, "b");
    const ev = await send("Runtime.evaluate", { returnByValue: true, expression: `JSON.stringify(Object.assign(window.__qc || {}, { canvas: [...document.querySelectorAll('canvas')]
      .map((c) => c.getBoundingClientRect()).map((r) => [r.x, r.y, r.width, r.height]).sort((a, b) => b[2] * b[3] - a[2] * a[3])[0] || null }))` });
    Object.assign(res, JSON.parse(ev.result?.value || "null") || {});
    res.ok = true;
    ws.close();
  } catch (e) {
    res.harness_error = String(e).slice(0, 300);
  } finally {
    proc.kill("SIGTERM");
    await sleep(300);
    rmSync(prof, { recursive: true, force: true });
  }
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(res, null, 1));
  return res;
}

for (const p of pages) {
  const r = await renderOne(p);
  console.log(`${r.name}: exc=${r.exceptions.length} webgl=${r.webgl} raf=${r.raf}${r.harness_error ? " HARNESS " + r.harness_error : ""}`);
}
