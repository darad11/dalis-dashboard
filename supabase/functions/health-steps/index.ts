// Edge Function "health-steps": steps from Apple Health, sent by an iOS Shortcut.
// Deployed WITHOUT JWT verification (the Shortcut has no Supabase login; the upload token
// in the body authenticates the call): supabase functions deploy health-steps --no-verify-jwt
// Request handling: ./handler.mjs
import { handleHealthSteps } from './handler.mjs';

// Secret key of the project, provided by Supabase to Edge Functions (never sent to clients):
// the new secret key ("default") if the project has one, else the legacy service_role key
function secretKey(): string | undefined {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const key = JSON.parse(keys).default;
      if (typeof key === 'string' && key) return key;
    } catch (_e) {
      // fall back to the legacy key
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || undefined;
}

Deno.serve((req: Request) =>
  handleHealthSteps(req, { supabaseUrl: Deno.env.get('SUPABASE_URL'), secretKey: secretKey() })
);
