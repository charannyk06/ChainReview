import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../index";

/**
 * Cache Supabase admin clients keyed by SUPABASE_URL.
 * This avoids the global singleton issue where a single cached client could
 * silently serve the wrong project if the env changes between requests
 * (e.g., in tests, staging vs. production, or multi-tenant setups).
 */
const _clients = new Map<string, SupabaseClient>();

/** Lazily-initialized Supabase admin client using service role key. */
export function getSupabaseAdmin(env: Env): SupabaseClient {
  const cacheKey = env.SUPABASE_URL;
  let client = _clients.get(cacheKey);

  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    _clients.set(cacheKey, client);
  }

  return client;
}

/** Verify a Supabase JWT and return the user payload. */
export async function verifyJWT(
  env: Env,
  jwt: string
): Promise<{ id: string; email: string; role: string } | null> {
  const supabase = getSupabaseAdmin(env);
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email || "",
    role: data.user.role || "authenticated",
  };
}
