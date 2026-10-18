'use strict';
// Screenshots des Premium-Prototyps: node screenshots.js <ausgabe-ordner> [filter]  (Playwright + Chromium)
// Echte Viewports statt Rahmen: so sieht Chromium die Seite, als wäre sie das Gerät. Die
// iPhone-Duo-Maße sind Annahmen (siehe README); der Faltzustand wird nicht erkannt, sondern als
// Wechsel des Viewports simuliert.
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' };
function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      const file = path.normalize(path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// Viewports (CSS-px). Duo: Annahmen, siehe README. Touch = isMobile + hasTouch.
const VIEWPORTS = {
  'duo-closed': { width: 466, height: 678, touch: true },
  'duo-open': { width: 626, height: 890, touch: true },
  'duo-open-land': { width: 890, height: 626, touch: true },
  'phone': { width: 393, height: 852, touch: true },
  'ipad': { width: 820, height: 1180, touch: true },
  'ipad-land': { width: 1180, height: 820, touch: true },
  'desk-narrow': { width: 1024, height: 768, touch: false },
  'desk': { width: 1440, height: 900, touch: false },
  'desk-wide': { width: 1920, height: 1080, touch: false }
};
const VIEWS = ['home', 'tasks', 'week', 'inbox'];
const SHOTS = [];
// Alle Ansichten auf allen Viewports, hell
for (const vp of Object.keys(VIEWPORTS)) for (const v of VIEWS) SHOTS.push({ name: `${vp}-${v}`, vp, hash: v });
// Dunkel: Home und Woche je Viewport
for (const vp of Object.keys(VIEWPORTS)) for (const v of ['home', 'week']) SHOTS.push({ name: `${vp}-${v}-dark`, vp, hash: v, dark: true });
// Interaktionen und Zustände
const INTERACTIVE = [
  { name: 'duo-closed-capture', vp: 'duo-closed', hash: 'home', demo: 'typed' },
  { name: 'duo-closed-capture-kbd', vp: 'duo-closed', hash: 'home', demo: 'typed', kbd: true },
  { name: 'duo-closed-detail', vp: 'duo-closed', hash: 'tasks', demo: 'detail' },
  { name: 'duo-closed-triage', vp: 'duo-closed', hash: 'inbox', demo: 'triage' },
  { name: 'duo-closed-plan', vp: 'duo-closed', hash: 'week', demo: 'plan' },
  { name: 'duo-closed-close', vp: 'duo-closed', hash: 'home', demo: 'close' },
  { name: 'duo-closed-evening', vp: 'duo-closed', hash: 'home', evening: true },
  { name: 'duo-closed-stress', vp: 'duo-closed', hash: 'home', stress: true },
  { name: 'duo-closed-stress-tasks', vp: 'duo-closed', hash: 'tasks', stress: true },
  { name: 'duo-closed-empty', vp: 'duo-closed', hash: 'home', demo: 'empty' },
  { name: 'duo-closed-safe', vp: 'duo-closed', hash: 'home', safe: true },
  { name: 'duo-closed-friday', vp: 'duo-closed', hash: 'week', demo: 'day', arg: 4 },
  { name: 'duo-closed-more', vp: 'duo-closed', hash: 'home', demo: 'more' },
  { name: 'duo-open-detail', vp: 'duo-open', hash: 'tasks', demo: 'detail' },
  { name: 'duo-open-capture-kbd', vp: 'duo-open', hash: 'home', demo: 'typed', kbd: true },
  { name: 'duo-open-stress', vp: 'duo-open', hash: 'home', stress: true },
  { name: 'duo-open-land-stress-week', vp: 'duo-open-land', hash: 'week', stress: true },
  { name: 'duo-open-land-triage', vp: 'duo-open-land', hash: 'inbox', demo: 'triage' },
  { name: 'phone-capture-kbd', vp: 'phone', hash: 'inbox', demo: 'typed', kbd: true, safe: true },
  { name: 'phone-detail-dark', vp: 'phone', hash: 'tasks', demo: 'detail', dark: true },
  { name: 'phone-stress-tasks', vp: 'phone', hash: 'tasks', stress: true },
  { name: 'ipad-plan', vp: 'ipad', hash: 'week', demo: 'plan' },
  { name: 'desk-filter', vp: 'desk', hash: 'tasks', demo: 'filter' },
  { name: 'desk-stress-week', vp: 'desk', hash: 'week', stress: true },
  { name: 'desk-stress-week-dark', vp: 'desk', hash: 'week', stress: true, dark: true },
  { name: 'desk-closed', vp: 'desk', hash: 'home', demo: 'closed' },
  { name: 'desk-narrow-detail', vp: 'desk-narrow', hash: 'tasks', demo: 'detail' },
  { name: 'desk-filter-set', vp: 'desk', hash: 'home', demo: 'filterSet', arg: 'ra' },
  { name: 'duo-closed-tasks-next', vp: 'duo-closed', hash: 'tasks', demo: 'area', arg: 'next' }
];
SHOTS.push(...INTERACTIVE);

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
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.touch, hasTouch: vp.touch, deviceScaleFactor: 2, colorScheme: shot.dark ? 'dark' : 'light', locale: 'de-AT' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${shot.name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${shot.name}: console ${m.text()}`); });
    await page.goto(`http://127.0.0.1:${port}/#${shot.hash}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    if (shot.stress) await page.evaluate(() => window.Proto.setStress(true));
    if (shot.evening) await page.evaluate(() => window.Proto.setEvening(true));
    if (shot.safe) await page.evaluate(() => window.Proto.setSafe(true));
    if (shot.demo) await page.evaluate(([n, a]) => window.Proto.demo(n, a), [shot.demo, shot.arg]);
    if (shot.kbd) await page.evaluate(() => window.Proto.setKeyboard(true));
    await page.waitForTimeout(350);
    const info = await page.evaluate(() => ({
      mode: window.Proto.mode(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainOverflow: (() => { const m = document.getElementById('main'); return m.scrollWidth - m.clientWidth; })(),
      fonts: Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i)
    }));
    await page.screenshot({ path: path.join(out, `${shot.name}.png`) });
    report.push({ name: shot.name, ...info });
    await context.close();
  }
  await browser.close();
  server.close();
  console.log(JSON.stringify({ shots: report.length, overflow: report.filter(r => r.overflow || r.mainOverflow).map(r => r.name), fonts: report[0] && report[0].fonts, errors }, null, 1));
  fs.writeFileSync(path.join(out, '_report.json'), JSON.stringify(report, null, 1));
})();
