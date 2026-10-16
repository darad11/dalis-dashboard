// Step Challenge: a day's steps from Apple Health, sent by an iOS Shortcut.
//
//   POST /functions/v1/health-steps
//   {"token": "<upload token>", "date": "2026-10-16", "steps": 12345}
//
// There is no Supabase login in a Shortcut: the personal upload token (created in the
// dashboard, only its SHA-256 hash is stored) identifies the user. The database function
// public.submit_health_steps() checks it and stores the value; only the secret key
// (service role) may call that function, and the key never leaves this function.
// See migrations/2026-10-16_step_health_sync.sql and docs/STEP_CHALLENGE.md.
//
// Plain JavaScript without Deno APIs, so tests/unit/health-steps.test.js can run it in Node.

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const USAGE = 'POST JSON {"token", "date": "YYYY-MM-DD", "steps"}';

function reply(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extraHeaders)
  });
}

function validDay(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "2026-10-16", also with a time after it ("2026-10-16T18:00:00+02:00"), or "16.10.2026". */
export function parseDate(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  if (m && validDay(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (m && validDay(+m[3], +m[2], +m[1])) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * Steps as a Shortcut may send them: a number, or text from a text field ("12345",
 * "12.345" / "12,345" / "12 345" with thousands separators, "12345,0", "12.345 Schritte").
 */
export function parseSteps(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  if (typeof value !== 'string') return null;
  const m = /^\s*([0-9][0-9.,'\s  ]*)(?:\s*[^\d\s.,'][^\d]*)?$/.exec(value);
  if (!m) return null;
  const text = m[1].replace(/[\s  ]+/g, '');
  if (/^\d+$/.test(text)) return Number(text);
  if (/^\d{1,3}([.,']\d{3})+$/.test(text)) return Number(text.replace(/[.,']/g, ''));
  if (/^\d+[.,]\d{1,2}$/.test(text)) return Math.round(Number(text.replace(',', '.')));
  return null;
}

// New secret keys (sb_secret_...) go on the apikey header only; a legacy service_role JWT
// is also sent as bearer token.
function keyHeaders(key) {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * @param {Request} req
 * @param {{ supabaseUrl?: string, secretKey?: string, fetch?: typeof fetch }} env
 */
export async function handleHealthSteps(req, env) {
  if (req.method !== 'POST') return reply(405, { ok: false, error: `Use ${USAGE}` }, { Allow: 'POST' });
  const { supabaseUrl, secretKey } = env;
  if (!supabaseUrl || !secretKey) return reply(500, { ok: false, error: 'The function is not configured' });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return reply(400, { ok: false, error: `The request body must be JSON: ${USAGE}` });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply(400, { ok: false, error: `The request body must be JSON: ${USAGE}` });
  }
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!TOKEN_PATTERN.test(token)) {
    return reply(401, { ok: false, error: 'Unknown upload token: copy it again from the dashboard (Step Challenge → Apple Health)' });
  }
  const date = parseDate(body.date);
  if (!date) return reply(400, { ok: false, error: 'date must be a day like 2026-10-16 (Format Date: yyyy-MM-dd)' });
  const steps = parseSteps(body.steps);
  if (steps === null) return reply(400, { ok: false, error: 'steps must be a number' });

  let res;
  try {
    res = await (env.fetch || fetch)(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/submit_health_steps`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, keyHeaders(secretKey)),
      body: JSON.stringify({ p_token: token, p_date: date, p_steps: steps })
    });
  } catch (e) {
    return reply(502, { ok: false, error: 'The database is not reachable, try again later' });
  }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }

  if (res.ok && data && typeof data.steps === 'number') {
    const kept = data.updated === false;
    return reply(200, {
      ok: true,
      date: data.date || date,
      steps: data.steps,
      updated: !kept,
      message: kept
        ? `${data.steps} steps on ${date} already stored (a lower count never replaces it)`
        : `Saved: ${data.steps} steps on ${date}`
    });
  }
  const code = data && data.code;
  if (code === '28000') return reply(401, { ok: false, error: 'Unknown or revoked upload token: create a new one in the dashboard' });
  if (code === '22008') return reply(400, { ok: false, error: 'date must be within the last 31 days' });
  if (code === '22003') return reply(400, { ok: false, error: 'steps must be between 0 and 200000' });
  // Details of database errors stay in the function's logs, not in the answer
  console.error('submit_health_steps failed', res.status, code || '');
  return reply(502, { ok: false, error: 'Could not save the steps, try again later' });
}
