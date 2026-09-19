'use strict';

/**
 * AuraVault — documentation screenshots (`npm run shots:web`).
 *
 * Serves src/ locally and captures the exact app UI with headless Chromium
 * (its software compositor handles the glass effects beautifully). The page
 * boots in browser-preview mode with sample data; `#gallery/<view>[/dark]`
 * routes it to the view to capture and hides the preview banner.
 *
 * Requires Chromium on PATH. Output: shots/web/*.png (Retina, 2560×1664).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'shots', 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const SHOTS = [
  ['home-light', 'gallery/home'],
  ['home-dark', 'gallery/home/dark'],
  ['detail', 'gallery/detail'],
  ['add-sheet', 'gallery/add-sheet'],
  ['generator', 'gallery/generator'],
  ['settings', 'gallery/settings'],
  ['security', 'gallery/security'],
  ['lock', 'gallery/lock'],
];

function chromiumBinary() {
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  // last resort: anything named like a browser on PATH
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'chrome']) {
    for (const dir of pathDirs) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('Chromium not found — install it first (apt install chromium)');
}

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    let file = path.join(SRC, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(SRC)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const bin = chromiumBinary();
  const server = await startServer();
  const port = server.address().port;
  console.log(`[web-shots] serving src/ on http://127.0.0.1:${port} · browser: ${bin}`);

  const run = (args) => new Promise((resolve, reject) => {
    // async on purpose: a *sync* spawn would freeze the event loop and the
    // HTTP server above could never answer the browser loading the page.
    execFile(bin, args, { timeout: 90000 }, (err) => (err ? reject(err) : resolve()));
  });

  let failed = 0;
  for (const [name, hash] of SHOTS) {
    const outFile = path.join(OUT, `${name}.png`);
    let ok = false;

    for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'av-webshots-'));
      const args = [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=2',
        '--window-size=1280,832',
        `--user-data-dir=${profile}`,
        '--timeout=15000',
        `--screenshot=${outFile}`,
        `http://127.0.0.1:${port}/#${hash}`,
      ];
      try {
        await run(args);
        const size = fs.statSync(outFile).size;
        if (size < 150000) throw new Error(`capture too small (${size} bytes)`);
        ok = true;
        console.log(`[web-shots] ${name}.png (${(size / 1024).toFixed(0)} KB${attempt > 1 ? `, attempt ${attempt}` : ''})`);
      } catch (err) {
        if (attempt === 4) console.error(`[web-shots] FAILED: ${name} — ${err.message}`);
        else await new Promise((r) => setTimeout(r, 800));
      } finally {
        fs.rmSync(profile, { recursive: true, force: true });
      }
    }
    if (!ok) failed++;
  }

  server.close();
  console.log(failed ? `[web-shots] ${failed} capture(s) failed` : '[web-shots] all captures done');
  process.exitCode = failed ? 1 : 0;
}

main();
