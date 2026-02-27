import Anthropic from "@anthropic-ai/sdk";

/**
 * Factory for creating Anthropic SDK clients that supports dual-mode operation:
 *
 * - **BYOK mode** (default): Reads ANTHROPIC_API_KEY from environment.
 *   Calls go directly to Anthropic's API. No changes to existing behavior.
 *
 * - **Managed mode**: Uses a JWT as the Bearer token and routes all traffic
 *   through the ChainReview API proxy (which handles billing, rate limiting,
 *   and usage tracking). The proxy mimics the Anthropic API surface, so the
 *   SDK works unchanged — only `baseURL` and `apiKey` differ.
 *
 * All LLM call sites should use `createAnthropicClient()` instead of
 * `new Anthropic()` to support both modes transparently.
 */
export function createAnthropicClient(): Anthropic {
  const mode = process.env.CHAINREVIEW_MODE;

  if (mode === "managed") {
    const jwt = process.env.CHAINREVIEW_JWT;
    const proxyUrl = process.env.CHAINREVIEW_PROXY_URL;

    if (!jwt || !proxyUrl) {
      throw new Error(
        "Managed mode requires CHAINREVIEW_JWT and CHAINREVIEW_PROXY_URL environment variables."
      );
    }

    return new Anthropic({
      apiKey: jwt,
      baseURL: proxyUrl,
    });
  }

  // BYOK mode: default behavior — Anthropic SDK reads ANTHROPIC_API_KEY from env
  return new Anthropic();
}

/**
 * Check whether the current environment has valid authentication
 * for making LLM calls (either BYOK or managed mode).
 */
export function hasLLMAuth(): boolean {
  const hasByok = !!process.env.ANTHROPIC_API_KEY;
  const hasManaged =
    process.env.CHAINREVIEW_MODE === "managed" &&
    !!process.env.CHAINREVIEW_JWT &&
    !!process.env.CHAINREVIEW_PROXY_URL;
  return hasByok || hasManaged;
}
