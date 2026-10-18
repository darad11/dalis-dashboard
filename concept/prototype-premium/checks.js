'use strict';
// Bedien-Prüfung des Premium-Prototyps: node checks.js  (Playwright + Chromium, ohne Ausgabeordner)
// Faltwechsel (Viewport wechselt, während ein Sheet offen ist – bleibt der getippte Text?),
// Tastaturbedienung, Zwei-Tipp-Wege, Berührungsziele, Bewegung reduzieren, Hell/Dunkel.
// Die iPhone-Duo-Maße sind Annahmen (siehe README); ein echter Faltwechsel wird nur als
// Viewport-Wechsel simuliert. Beendet sich mit Exit-Code 1, wenn ein Punkt fehlschlägt.
const path = require('path');
const { execSync } = require('child_process');
function pw() { try { return require('playwright'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } }
const http = require('http'); const fs = require('fs');
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const { chromium } = pw();
  const browser = await chromium.launch();
  const out = [];
  const ok = (name, cond, extra) => out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' – ' + extra : ''}`);
  // 1. Duo zu → auf, während im Notieren-Sheet getippt wird
  let ctx = await browser.newContext({ viewport: { width: 466, height: 678 }, isMobile: true, hasTouch: true });
  let page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/#home`); await page.waitForTimeout(300);
  ok('kompakt am geschlossenen Duo', (await page.evaluate(() => window.Proto.mode())) === 'compact');
  await page.click('.topbar [data-action="capture"]');
  await page.fill('#captureInput', 'Zement für Abschnitt 3 nachbestellen');
  await page.evaluate(() => Promise.all(document.querySelector('.sheet').getAnimations().map(a => a.finished)));
  let box = await page.locator('.sheet').boundingBox();
  ok('Sheet unten am geschlossenen Duo', Math.round(box.y + box.height) === 678, `unten bei ${Math.round(box.y + box.height)}`);
  await page.setViewportSize({ width: 626, height: 890 }); await page.waitForTimeout(300);
  ok('mittel am geöffneten Duo', (await page.evaluate(() => window.Proto.mode())) === 'medium');
  ok('Sheet bleibt offen nach dem Aufklappen', await page.locator('.sheet').count() === 1);
  ok('Getippter Text bleibt', (await page.inputValue('#captureInput')) === 'Zement für Abschnitt 3 nachbestellen');
  box = await page.locator('.sheet').boundingBox();
  ok('Sheet mittig am geöffneten Duo', Math.abs((box.x + box.width / 2) - 313) < 3 && box.y > 40, `x-Mitte ${Math.round(box.x + box.width / 2)}, y ${Math.round(box.y)}`);
  await page.setViewportSize({ width: 466, height: 678 }); await page.waitForTimeout(300);
  ok('Zuklappen: Text noch da', (await page.inputValue('#captureInput')) === 'Zement für Abschnitt 3 nachbestellen');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  ok('Enter legt in den Eingang (Sheet zu)', await page.locator('.sheet').count() === 0 && (await page.evaluate(() => window.Proto.state().inbox[0].text)) === 'Zement für Abschnitt 3 nachbestellen');
  // 2. Detail-Sheet offen, Faltwechsel, Auswahl bleibt
  await page.evaluate(() => window.Proto.demo('detail', 2)); await page.waitForTimeout(100);
  await page.click('.sheet [data-action="set-est"][data-est="60"]'); await page.waitForTimeout(100);
  await page.setViewportSize({ width: 890, height: 626 }); await page.waitForTimeout(300);
  ok('Detail bleibt nach Faltwechsel offen, Schätzung 60 gesetzt', await page.locator('.sheet[data-sheet="detail"]').count() === 1 && (await page.evaluate(() => window.Proto.state().tasks.find(t => t.id === 2).est)) === 60);
  ok('Navigation springt nicht (noch Home)', (await page.evaluate(() => location.hash)) === '#home');
  await page.keyboard.press('Escape'); ok('Escape schließt das Sheet', await page.locator('.sheet').count() === 0);
  // 3. Zwei-Tipp-Wege
  await page.goto(`http://127.0.0.1:${port}/#inbox`); await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.Proto.state().tasks.length);
  await page.click('.inbox-item [data-action="triage"][data-kind="today"]'); await page.waitForTimeout(100);
  ok('Eingang → Heute: ein Tipp', (await page.evaluate(() => window.Proto.state().tasks.length)) === before + 1);
  await page.goto(`http://127.0.0.1:${port}/#home`); await page.waitForTimeout(200);
  const nowId = await page.evaluate(() => Number(document.querySelector('.now [data-action="toggle"]').dataset.id));
  await page.click('.now [data-action="toggle"]'); await page.waitForTimeout(100);
  ok('Jetzt → Erledigt: ein Tipp, nächster rückt nach', (await page.evaluate(id => window.Proto.state().tasks.find(t => t.id === id).done, nowId)) === true && (await page.evaluate(() => Number(document.querySelector('.now [data-action="toggle"]').dataset.id))) !== nowId);
  // 4. Tastatur: Tab erreicht Häkchen und Zeilen, Enter öffnet das Detail
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  let focused = await page.evaluate(() => document.activeElement.className);
  for (let i = 0; i < 12 && !/main/.test(focused); i++) { await page.keyboard.press('Tab'); focused = await page.evaluate(() => document.activeElement.className); }
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  ok('Tastatur: Enter auf einer Zeile öffnet das Detail', await page.locator('.sheet[data-sheet="detail"]').count() === 1, `Fokus war: ${focused}`);
  await page.keyboard.press('Escape');
  // 5. Touch-Ziele ≥ 40 px (alle Knöpfe/Links in der App; Häkchen sichtbar 22 px, Berührungsfläche 44 px über ::before)
  const scanSmall = () => page.evaluate(() => Array.from(document.querySelectorAll('#app button, #app a, #app [role="button"]')).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40); }).map(el => `${el.className.split(' ')[0] || el.tagName}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
  const checks = [];
  for (const [w, h, label] of [[466, 678, 'Duo zu'], [626, 890, 'Duo auf'], [1180, 820, 'iPad quer']]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
    for (const view of ['home', 'tasks', 'week', 'inbox']) {
      await page.evaluate(v => { location.hash = v; }, view); await page.waitForTimeout(200);
      const small = (await scanSmall()).filter(s => !s.startsWith('check'));
      checks.push([`${label} · ${view}`, small]);
    }
    await page.evaluate(() => window.Proto.demo('detail')); await page.waitForTimeout(250);
    checks.push([`${label} · Detail-Sheet`, (await scanSmall()).filter(s => !s.startsWith('check'))]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await page.evaluate(() => window.Proto.demo('close')); await page.waitForTimeout(250);
    checks.push([`${label} · Tagesabschluss`, (await scanSmall()).filter(s => !s.startsWith('check'))]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  }
  for (const [label, small] of checks) ok(`Berührungsziele ≥ 40 px: ${label}`, small.length === 0, small.slice(0, 10).join(', '));
  // Häkchen: ein Tipp 9 px neben dem sichtbaren Kreis trifft trotzdem (Berührungsfläche 44 px)
  await page.setViewportSize({ width: 466, height: 678 }); await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = 'tasks'; }); await page.waitForTimeout(200);
  const chk = page.locator('.row .check').first();
  const cb = await chk.boundingBox(); const chkId = await chk.getAttribute('data-id');
  const doneOf = () => page.evaluate(i => window.Proto.state().tasks.find(t => String(t.id) === String(i)).done, chkId);
  const chkBefore = await doneOf();
  await page.touchscreen.tap(cb.x - 9, cb.y + cb.height / 2); await page.waitForTimeout(200);
  const chkAfter = await doneOf();
  ok('Häkchen: Tipp 9 px neben dem Kreis trifft', chkBefore !== chkAfter, `Aufgabe ${chkId}: vorher ${chkBefore}, nachher ${chkAfter}`);
  // Zeile: Tipp in den Zeilenrand (oberhalb des Textes) öffnet das Detail
  await page.evaluate(() => window.Proto.reset()); await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = 'tasks'; }); await page.waitForTimeout(200);
  const main = page.locator('.row .main[role="button"]').first();
  const mb = await main.boundingBox();
  ok('Zeilen-Hauptteil ≥ 44 px hoch', mb.height >= 44, `${Math.round(mb.width)}x${Math.round(mb.height)}`);
  await page.touchscreen.tap(mb.x + 40, mb.y + 3); await page.waitForTimeout(300);
  ok('Tipp am oberen Zeilenrand öffnet das Detail', await page.locator('.sheet[data-sheet="detail"]').count() === 1);
  await page.keyboard.press('Escape');
  // 6. Bewegung reduzieren: keine Animation beim Sheet
  await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 466, height: 678 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${port}/#home`); await page.waitForTimeout(300);
  await page.click('.topbar [data-action="capture"]');
  ok('Bewegung reduzieren: Sheet ohne Animation', (await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).animationName)) === 'none');
  await ctx.close();
  // 7. Dark mode tokens: body background follows
  ctx = await browser.newContext({ viewport: { width: 466, height: 678 }, colorScheme: 'dark' });
  page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${port}/#home`); await page.waitForTimeout(200);
  ok('Dunkel: Hintergrund warm dunkel', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(22, 21, 18)');
  await page.evaluate(() => window.Proto.setTheme('light')); await page.waitForTimeout(50);
  ok('Schalter Hell überstimmt System', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(245, 243, 238)');
  await ctx.close();
  await browser.close(); server.close();
  out.push(`Seitenfehler: ${errors.length}`);
  console.log(out.join('\n'));
  if (out.some(l => l.startsWith('FAIL')) || errors.length) process.exitCode = 1;
})();
