// Headless Chrome screenshot driver (DevTools protocol, no dependencies).
// Usage: node dev/shot.mjs [--dark] [--run "js"] [--wait ms] [--shot name] ... (steps run in order)
// Screenshots land in dev/shots/<name>.png at iPhone 16 Pro size (402x874 CSS px).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dev', 'shots');
mkdirSync(outDir, { recursive: true });
const profile = process.env.SHOT_PROFILE || path.join(process.env.TMPDIR || '/tmp', 'invoices-shot-profile');
const PORT = 8765, CDP = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const dark = args.includes('--dark');
const keep = args.includes('--keep');
const width = 402, height = 874;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
process.on('exit', cleanup);
process.on('unhandledRejection', (e) => { console.error('[fatal]', e); cleanup(); process.exit(1); });
setTimeout(() => { console.error('[fatal] timeout'); cleanup(); process.exit(1); }, 90000).unref();

async function waitFor(url, tries = 400) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timeout waiting for ' + url);
}

const targets = await (await waitFor(`http://127.0.0.1:${CDP}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); }
  else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) console.log('[console.' + msg.params.type + ']', msg.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (msg.method === 'Runtime.exceptionThrown') console.log('[exception]', msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') console.log('[log]', msg.params.entry.text, msg.params.entry.url || '');
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
await waitFor(`http://127.0.0.1:${PORT}/index.html`);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?sim=iphone&nosw=1&t=${Date.now()}` });
await sleep(900);

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--run') {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${args[++i]} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) console.log('[run error]', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    else if (r.result && r.result.value !== undefined) console.log('[run]', JSON.stringify(r.result.value));
    await sleep(500);
  } else if (a === '--wait') { await sleep(Number(args[++i])); }
  else if (a === '--shot') {
    const name = args[++i];
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  }
}
if (!keep) { ws.close(); cleanup(); }
process.exit(0);
