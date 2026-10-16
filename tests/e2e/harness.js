/*
 * Shared e2e harness: static file server for the repo, Playwright launcher and
 * page factory that swaps the Supabase CDN script for the in-memory mock.
 * No network access to Supabase or any CDN happens during the tests.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CloudStore } = require('./cloud-store');

const ROOT = path.resolve(__dirname, '..', '..');
const MOCK_SCRIPT = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const filePath = path.normalize(path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(filePath, (err, body) => {
      if (err) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

async function createEnv(options = {}) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const { server, url } = await startServer();
  const store = new CloudStore();
  return { browser, server, url, store, chromium };
}

/**
 * Opens the dashboard in a fresh page.
 * opts.context  reuse an existing BrowserContext (shares localStorage = same device)
 * opts.viewport {width,height}; opts.colorScheme; opts.now (ms epoch) fixes the clock
 */
async function openDashboard(env, opts = {}) {
  const context = opts.context || await env.browser.newContext({
    viewport: opts.viewport || { width: 1440, height: 900 },
    deviceScaleFactor: opts.deviceScaleFactor || 1,
    isMobile: !!opts.isMobile,
    hasTouch: !!opts.hasTouch,
    locale: 'de-AT',
    timezoneId: opts.timezoneId || 'Europe/Vienna',
    colorScheme: opts.colorScheme || 'light'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  if (opts.now) {
    await page.clock.install({ time: opts.now });
  }

  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_SCRIPT }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  if (!context.__cloudBound) {
    // context.__offline simulates one device losing its connection
    await context.exposeBinding('__cloud', async (source, op) => {
      if (source.context.__offline) {
        return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 };
      }
      return env.store.handle(op);
    });
    context.__cloudBound = true;
  }
  const unsubscribe = env.store.onChange(payload => {
    if (page.isClosed()) return;
    page.evaluate(p => window.__mockRealtimeDispatch && window.__mockRealtimeDispatch(p), payload).catch(() => { });
  });
  page.on('close', unsubscribe);

  if (opts.authDelayMs) {
    await page.addInitScript(ms => { window.__mockAuthDelayMs = ms; }, opts.authDelayMs);
  }
  await page.goto(env.url);
  await page.waitForFunction(() => document.querySelector('#goalsList') !== null);
  return { page, context, errors };
}

async function settle(page, ms = 400) {
  await page.waitForTimeout(ms);
}

module.exports = { createEnv, openDashboard, settle, loadPlaywright, ROOT };
