import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health";
import { proxy } from "./routes/proxy";
import { usage } from "./routes/usage";
import { reviews } from "./routes/reviews";
import { billing } from "./routes/billing";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ENVIRONMENT: string;
}

export interface Variables {
  userId: string;
  userEmail: string;
  userRole: string;
  userPlan: string;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://chainreview.dev",
  "https://dashboard.chainreview.dev",
];

// Global middleware
app.use("*", logger());

// CORS for /api/* routes
app.use(
  "/api/*",
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "x-api-key", "anthropic-version", "anthropic-beta"],
    maxAge: 86400,
  })
);

// CORS for /v1/* routes (LLM proxy)
app.use(
  "/v1/*",
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "x-api-key", "anthropic-version", "anthropic-beta"],
    maxAge: 86400,
  })
);

// Mount routes
app.route("/", health);
app.route("/", proxy);
app.route("/", usage);
app.route("/", reviews);
app.route("/", billing);

// 404 fallback
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);

  const isProduction = c.env.ENVIRONMENT === "production";

  return c.json(
    {
      error: "Internal server error",
      // Only include the error message in non-production environments
      ...(isProduction ? {} : { message: err.message }),
    },
    500
  );
});

export default app;
