import type { Env } from "../index";

const ANTHROPIC_API_URL = "https://api.anthropic.com";

/**
 * Forward a request to the Anthropic API, streaming the response back.
 * Acts as a transparent proxy — the client SDK thinks it's talking to Anthropic directly.
 */
export async function proxyToAnthropic(
  env: Env,
  request: Request,
  body: string
): Promise<Response> {
  const url = new URL(request.url);
  // Rewrite path to Anthropic: /v1/messages → https://api.anthropic.com/v1/messages
  const targetUrl = `${ANTHROPIC_API_URL}${url.pathname}`;

  const headers = new Headers();
  headers.set("x-api-key", env.ANTHROPIC_API_KEY);
  headers.set("anthropic-version", request.headers.get("anthropic-version") || "2023-06-01");
  headers.set("content-type", "application/json");

  // Forward anthropic-beta header if present (for extended thinking, etc.)
  const beta = request.headers.get("anthropic-beta");
  if (beta) headers.set("anthropic-beta", beta);

  const startMs = Date.now();

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
    });
  } catch (err) {
    console.error("Network error proxying to Anthropic:", err);
    return new Response(
      JSON.stringify({ error: "Upstream service unavailable" }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      }
    );
  }

  // If Anthropic returned an error, return a generic error to the client
  // instead of leaking Anthropic-specific error details
  if (!anthropicRes.ok) {
    // Log the full error for server-side debugging
    const errorBody = await anthropicRes.text().catch(() => "unknown");
    console.error(
      `Anthropic API error (${anthropicRes.status}):`,
      errorBody
    );

    // Map Anthropic status codes to appropriate proxy responses
    const statusMap: Record<number, { status: number; message: string }> = {
      400: { status: 400, message: "Invalid request to upstream model" },
      401: { status: 502, message: "Upstream authentication error" },
      403: { status: 502, message: "Upstream authorization error" },
      429: { status: 429, message: "Upstream rate limit exceeded, please retry later" },
      500: { status: 502, message: "Upstream service error" },
      529: { status: 503, message: "Upstream service is overloaded, please retry later" },
    };

    const mapped = statusMap[anthropicRes.status] || {
      status: 502,
      message: "Upstream service error",
    };

    return new Response(
      JSON.stringify({ error: mapped.message }),
      {
        status: mapped.status,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      }
    );
  }

  // Return the successful response as-is (including streaming SSE)
  const responseHeaders = new Headers(anthropicRes.headers);
  // Add timing header for client observability
  responseHeaders.set("x-proxy-latency-ms", String(Date.now() - startMs));
  // CORS for web dashboard calls
  responseHeaders.set("access-control-allow-origin", "*");

  return new Response(anthropicRes.body, {
    status: anthropicRes.status,
    statusText: anthropicRes.statusText,
    headers: responseHeaders,
  });
}
