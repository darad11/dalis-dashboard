'use strict';
// Renderings der Designstudie: node screenshots.js <ausgabe-ordner> [filter]  (Playwright + Chromium)
// Lädt a.html / b.html / c.html mit echten Viewports. iPhone-Duo-Maße sind Annahmen (siehe README);
// der Faltzustand wird nur als Viewport-Wechsel simuliert. Nichts davon ist ein Test auf echter Hardware.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
function loadPlaywright() {
  try { return require('playwright'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
}
const ROOT = path.resolve(__dirname, '..'); // concept/ – die Lader verweisen auf ../prototype-premium/
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' };
function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
const VIEWPORTS = {
  'duo-closed': { width: 466, height: 678, touch: true, label: 'iPhone Duo zu (Annahme)' },
  'duo-open': { width: 626, height: 890, touch: true, label: 'iPhone Duo auf, hoch (Annahme)' },
  'desk': { width: 1440, height: 900, touch: false, label: 'Desktop' }
};
const VARIANTS = ['a', 'b', 'c'];
// Die geforderten Vergleichsansichten je Variante (plus Desktop-Home und Desktop-Woche)
const BASE = [
  { view: 'home', vp: 'duo-closed' }, { view: 'home', vp: 'duo-open' },
  { view: 'tasks', vp: 'duo-closed' }, { view: 'tasks', vp: 'duo-open' },
  { view: 'inbox', vp: 'duo-closed' }, { view: 'inbox', vp: 'duo-open' },
  { view: 'week', vp: 'duo-closed' }, { view: 'week', vp: 'duo-open' },
  { view: 'home', vp: 'desk' }, { view: 'week', vp: 'desk' }
];
// Prüfansichten: lange Aufgaben, Sheets, Tastatur
const QA = [
  { name: 'qa-stress-tasks', view: 'tasks', vp: 'duo-closed', stress: true },
  { name: 'qa-stress-home', view: 'home', vp: 'duo-open', stress: true },
  { name: 'qa-detail', view: 'tasks', vp: 'duo-closed', demo: 'detail' },
  { name: 'qa-capture-kbd', view: 'inbox', vp: 'duo-closed', demo: 'typed', kbd: true },
  { name: 'qa-triage', view: 'inbox', vp: 'duo-open', demo: 'triage' },
  { name: 'qa-close', view: 'home', vp: 'duo-closed', demo: 'close' },
  { name: 'qa-plan-desk', view: 'week', vp: 'desk', demo: 'plan' },
  { name: 'qa-empty', view: 'home', vp: 'duo-closed', demo: 'empty' }
];
const SHOTS = [];
for (const v of VARIANTS) {
  for (const s of BASE) SHOTS.push({ name: `${v}-${s.view}-${s.vp}`, v, ...s });
  for (const s of QA) SHOTS.push({ ...s, name: `${v}-${s.name}`, v });
}

(async () => {
  const out = process.argv[2];
  const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const errors = [];
  const report = [];
  for (const shot of SHOTS) {
    if (filter && !filter.test(shot.name)) continue;
    const vp = VIEWPORTS[shot.vp];
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.touch, hasTouch: vp.touch, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'de-AT' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${shot.name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${shot.name}: console ${m.text()}`); });
    await page.goto(`http://127.0.0.1:${port}/design-directions/${shot.v}.html#${shot.view}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    if (shot.stress) await page.evaluate(() => window.Proto.setStress(true));
    if (shot.demo) await page.evaluate(([n, a]) => window.Proto.demo(n, a), [shot.demo, shot.arg]);
    if (shot.kbd) await page.evaluate(() => window.Proto.setKeyboard(true));
    await page.waitForTimeout(350);
    // Welche Schrift Chromium tatsächlich für den Titel benutzt (Plattform-Schriften über CDP)
    let renderedFont = '';
    try {
      const client = await context.newCDPSession(page);
      await client.send('DOM.enable'); await client.send('CSS.enable');
      const { root } = await client.send('DOM.getDocument');
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.display, .title, .sheet-title' });
      if (nodeId) { const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId }); renderedFont = fonts.map(f => `${f.familyName}${f.isCustomFont ? ' (Webfont)' : ' (System)'}`).join(', '); }
      await client.detach();
    } catch (e) { renderedFont = `unbekannt (${e.message})`; }
    const info = await page.evaluate(() => ({
      mode: window.Proto.mode(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainOverflow: (() => { const m = document.getElementById('main'); return m.scrollWidth - m.clientWidth; })(),
      bg: getComputedStyle(document.body).backgroundColor,
      fonts: Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i)
    }));
    await page.screenshot({ path: path.join(out, `${shot.name}.png`) });
    report.push({ name: shot.name, variant: shot.v, view: shot.view, viewport: `${vp.width}×${vp.height} ${vp.label}`, ...info, renderedFont });
    await context.close();
  }
  await browser.close();
  server.close();
  console.log(JSON.stringify({ shots: report.length, overflow: report.filter(r => r.overflow || r.mainOverflow).map(r => r.name), renderedFonts: [...new Set(report.map(r => `${r.variant}: ${r.renderedFont}`))], errors }, null, 1));
  fs.writeFileSync(path.join(out, '_report.json'), JSON.stringify(report, null, 1));
})();
