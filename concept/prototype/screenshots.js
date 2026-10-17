'use strict';
// Screenshots des Prototyps: node screenshots.js <ausgabe-ordner> [filter]  (braucht Playwright + Chromium)
// Serves concept/prototype over HTTP (file:// blocks nothing here, but a server matches the artifact).
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
      if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const SHOTS = [
  { name: 'home-desktop-A', device: 'desktop', hash: 'home' },
  { name: 'home-desktop-B', device: 'desktop', hash: 'home', variant: { home: 'plan' } },
  { name: 'home-desktop-dark', device: 'desktop', hash: 'home', dark: true },
  { name: 'home-phone-A', device: 'phone', hash: 'home' },
  { name: 'home-phone-B', device: 'phone', hash: 'home', variant: { home: 'plan' } },
  { name: 'home-phone-dark', device: 'phone', hash: 'home', dark: true },
  { name: 'home-phone-evening', device: 'phone', hash: 'home', action: 'evening' },
  { name: 'home-phone-focus', device: 'phone', hash: 'home', action: 'focus' },
  { name: 'home-phone-more', device: 'phone', hash: 'home', action: 'more' },
  { name: 'inbox-phone', device: 'phone', hash: 'inbox' },
  { name: 'inbox-phone-triage', device: 'phone', hash: 'inbox', action: 'triage' },
  { name: 'inbox-phone-dark', device: 'phone', hash: 'inbox', dark: true },
  { name: 'inbox-desktop', device: 'desktop', hash: 'inbox' },
  { name: 'tasks-desktop', device: 'desktop', hash: 'tasks' },
  { name: 'tasks-desktop-cards', device: 'desktop', hash: 'tasks', variant: { projects: 'cards' } },
  { name: 'tasks-desktop-detail', device: 'desktop', hash: 'tasks', action: 'detail' },
  { name: 'tasks-desktop-dark', device: 'desktop', hash: 'tasks', dark: true },
  { name: 'tasks-phone', device: 'phone', hash: 'tasks' },
  { name: 'tasks-phone-cards', device: 'phone', hash: 'tasks', variant: { projects: 'cards' } },
  { name: 'tasks-phone-detail', device: 'phone', hash: 'tasks', action: 'detail' },
  { name: 'week-desktop', device: 'desktop', hash: 'week' },
  { name: 'week-desktop-day', device: 'desktop', hash: 'week', action: 'day' },
  { name: 'week-desktop-day-two', device: 'desktop', hash: 'week', variant: { day: 'two' }, action: 'day' },
  { name: 'week-desktop-dark', device: 'desktop', hash: 'week', dark: true },
  { name: 'week-phone', device: 'phone', hash: 'week' },
  { name: 'week-phone-plan', device: 'phone', hash: 'week', action: 'plan' },
  { name: 'week-phone-dark', device: 'phone', hash: 'week', dark: true },
  { name: 'close-phone', device: 'phone', hash: 'close' },
  { name: 'close-phone-steps', device: 'phone', hash: 'close', variant: { close: 'steps' } },
  { name: 'close-phone-finished', device: 'phone', hash: 'close', action: 'finished' },
  { name: 'close-desktop', device: 'desktop', hash: 'close' },
  { name: 'review-desktop', device: 'desktop', hash: 'review' },
  { name: 'review-desktop-dark', device: 'desktop', hash: 'review', dark: true },
  { name: 'review-phone', device: 'phone', hash: 'review' },
  { name: 'ios-desktop', device: 'desktop', hash: 'ios', full: true },
  { name: 'ios-phone', device: 'phone', hash: 'ios' },
  { name: 'variants-desktop', device: 'desktop', hash: 'home', action: 'panel' },
  { name: 'wf1-s1', device: 'desktop', hash: 'home', action: 'workflow', next: 0 },
  { name: 'wf1-s2', device: 'desktop', hash: 'home', action: 'workflow', next: 1 },
  { name: 'wf1-s3', device: 'desktop', hash: 'home', action: 'workflow', next: 2 },
  { name: 'wf1-s4', device: 'desktop', hash: 'home', action: 'workflow', next: 3 },
  { name: 'wf1-s5', device: 'desktop', hash: 'home', action: 'workflow', next: 4 },
  { name: 'wf2-s1', device: 'phone', hash: 'home', action: 'workflow2', next: 0 },
  { name: 'wf2-s2', device: 'phone', hash: 'home', action: 'workflow2', next: 1 },
  { name: 'wf2-s3', device: 'phone', hash: 'home', action: 'workflow2', next: 2 },
  { name: 'wf2-s4', device: 'phone', hash: 'home', action: 'workflow2', next: 3 },
  { name: 'wf2-s5', device: 'phone', hash: 'home', action: 'workflow2', next: 4 },
  { name: 'wf3-s1', device: 'phone', hash: 'home', action: 'workflow3', next: 0 },
  { name: 'wf3-s2', device: 'phone', hash: 'home', action: 'workflow3', next: 1 },
  { name: 'wf3-s3', device: 'phone', hash: 'home', action: 'workflow3', next: 2 },
  { name: 'wf3-s4', device: 'desktop', hash: 'home', action: 'workflow3', next: 3 },
  { name: 'wf3-s5', device: 'desktop', hash: 'home', action: 'workflow3', next: 4 }
];

(async () => {
  const out = process.argv[2];
  const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const errors = [];
  for (const shot of SHOTS) {
    if (filter && !filter.test(shot.name)) continue;
    const phone = shot.device === 'phone';
    const context = await browser.newContext(phone
      ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: shot.dark ? 'dark' : 'light' }
      : { viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2, colorScheme: shot.dark ? 'dark' : 'light' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${shot.name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${shot.name}: console ${m.text()}`); });
    await page.goto(`http://127.0.0.1:${port}/#${shot.hash}`);
    await page.waitForTimeout(300);
    if (shot.variant) await page.evaluate(v => window.Proto.setVariants(v), shot.variant);
    if (shot.action) await page.evaluate(a => window.Proto.demoAction(a), shot.action);
    for (let k = 0; k < (shot.next || 0); k++) { await page.waitForTimeout(350); await page.evaluate(() => window.Proto.wfNext()); }
    await page.waitForTimeout(shot.next ? 900 : 500);
    await page.screenshot({ path: path.join(out, `${shot.name}.png`), fullPage: !!shot.full });
    console.log('shot', shot.name);
    await context.close();
  }
  await browser.close();
  server.close();
  console.log('errors', errors);
})();
