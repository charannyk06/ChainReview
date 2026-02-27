import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../index";
import { verifyJWT } from "../lib/supabase";

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies via Supabase,
 * and sets user info on the context.
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization") || c.req.header("x-api-key");

  if (!authHeader) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  // Support both "Bearer <jwt>" and raw JWT (Anthropic SDK sends x-api-key)
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token || token.trim().length === 0) {
    return c.json({ error: "Authorization header is empty" }, 401);
  }

  if (token.length < 10) {
    return c.json({ error: "Token is too short to be valid" }, 401);
  }

  // JWT format validation: must have exactly 3 dot-separated parts (header.payload.signature)
  const jwtParts = token.split(".");
  if (jwtParts.length !== 3 || jwtParts.some((part) => part.length === 0)) {
    return c.json({ error: "Malformed token: expected JWT format (header.payload.signature)" }, 401);
  }

  let user: { id: string; email: string; role: string } | null;
  try {
    user = await verifyJWT(c.env, token);
  } catch {
    return c.json({ error: "Token verification failed due to an internal error" }, 500);
  }

  if (!user) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  c.set("userId", user.id);
  c.set("userEmail", user.email);
  c.set("userRole", user.role);

  await next();
});
