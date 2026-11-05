import http from 'node:http';
import {watch} from 'node:fs';
import {copyFile, mkdir, readFile} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {context} from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Keep development bundles out of the offline assets shipped in the APK.
const base = resolve(root, '../toolchains/out/learning-dev');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf'};
const clients = new Set();
let revision = 0;
let errors = [];
const buildErrors = new Map();
let reloadTimer;
function notify() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    revision++;
    for (const client of clients) client.write(`event: build\ndata: ${JSON.stringify({revision})}\n\n`);
    console.log(`Preview updated (${revision})`);
  }, 80);
}
const notifications = {
  name: 'preview-reload',
  setup(build) {
    build.onEnd(result => {
      buildErrors.set(build.initialOptions.outfile, result.errors.map(error => error.text));
      errors = [...buildErrors.values()].flat();
      if (!errors.length) notify();
    });
  },
};
await mkdir(base, {recursive:true});
async function copyPages() {
  await Promise.all(['index.html', 'sandbox.html'].map(file => copyFile(resolve(root, file), resolve(base, file))));
}
await copyPages();
const common = {bundle:true, target:['chrome100'], logLevel:'info', plugins:[notifications]};
const contexts = await Promise.all([
  context({...common, entryPoints:[resolve(root, 'src/main.tsx')], outfile:resolve(base, 'app.js'), sourcemap:'linked',
    loader:{'.woff2':'file', '.woff':'file', '.ttf':'file'}, assetNames:'fonts/[name]-[hash]',
    define:{'process.env.NODE_ENV':'"development"'}}),
  context({...common, entryPoints:[resolve(root, 'src/sandbox.ts')], outfile:resolve(base, 'sandbox.js')}),
]);
await Promise.all(contexts.map(async build => { await build.rebuild(); await build.watch(); }));
const pageWatcher = watch(root, (event, file) => {
  if (file === 'index.html' || file === 'sandbox.html') copyPages().then(notify).catch(console.error);
});
const reloadScript = `const stream = new EventSource('/__dev/events');
stream.addEventListener('build', () => location.reload());
document.addEventListener('change', event => {
  if (event.target.matches('.component-picker select')) {
    const url = new URL(location.href); url.searchParams.set('demo', event.target.value);
    history.replaceState(null, '', url);
  }
});`;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const requested = decodeURIComponent(url.pathname);
    if (requested === '/__dev/events') {
      res.writeHead(200, {'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive'});
      res.write(`event: ready\ndata: ${JSON.stringify({revision})}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (requested === '/__dev/status') {
      res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      res.end(JSON.stringify({app:'dsh-ultra-learning-preview', revision, errors, clients:clients.size}));
      return;
    }
    if (requested === '/__dev/reload.js') {
      res.writeHead(200, {'Content-Type':types['.js'], 'Cache-Control':'no-store'});
      res.end(reloadScript);
      return;
    }
    if (requested === '/_preview') {
      const width = Math.max(320, Math.min(1000, Number(url.searchParams.get('width')) || 390));
      const kind = /^[a-z]+$/.test(url.searchParams.get('demo') || '') ? url.searchParams.get('demo') : 'function';
      res.writeHead(200, {'Content-Type':types['.html'], 'Cache-Control':'no-store'});
      res.end(`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH Ultra 手机预览</title><style>body{margin:0;display:grid;justify-content:center;background:#e6e8ed}iframe{border:0;display:block;width:min(${width}px,100vw);height:100vh;background:white}</style><iframe title="手机宽度预览" src="/?demo=${kind}"></iframe></html>`);
      return;
    }
    const file = resolve(base, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(base + sep)) { res.writeHead(403).end(); return; }
    let data = await readFile(file);
    if (file === resolve(base, 'index.html')) {
      // Only the local browser preview may connect to the reload stream.
      data = Buffer.from(data.toString().replace("connect-src 'none'", "connect-src 'self'")
        .replace('</body>', '<script src="/__dev/reload.js"></script></body>'));
    }
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
const heartbeat = setInterval(() => { for (const client of clients) client.write(': keepalive\n\n'); }, 15000);
server.on('error', error => { console.error(error.message); shutdown(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`DSH Ultra live preview: http://127.0.0.1:${port}/_preview?width=390&demo=function\nSave learning-ui/src files to rebuild and refresh automatically.`));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(heartbeat);
  clearTimeout(reloadTimer);
  pageWatcher.close();
  for (const client of clients) client.end();
  server.close();
  await Promise.all(contexts.map(build => build.dispose()));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
