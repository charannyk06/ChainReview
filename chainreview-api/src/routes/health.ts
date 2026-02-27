import { Hono } from "hono";
import type { Env, Variables } from "../index";

const health = new Hono<{ Bindings: Env; Variables: Variables }>();

health.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "chainreview-api",
    timestamp: new Date().toISOString(),
  });
});

export { health };
