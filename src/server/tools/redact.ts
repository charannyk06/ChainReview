// ── Secrets Redaction ──
// PRD Section 10: Basic secrets redaction before sending snippets to model

const REDACTED = "[REDACTED]";

// AWS access key IDs
const AWS_KEY_RE = /AKIA[A-Z0-9]{16}/g;

// JWT tokens
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

// Connection strings (postgres, mysql, mongodb, redis)
const CONN_STRING_RE = /(postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|amqp):\/\/[^\s"'`]+/gi;

// .env style values: KEY=value
const ENV_VALUE_RE = /^([A-Z][A-Z0-9_]{2,})=(.+)$/gm;

// Generic secrets adjacent to keywords
const SECRET_KEYWORD_RE =
  /(api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|password|passwd|client[_-]?secret|signing[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9_/+\-.]{16,})["']?/gi;

// GitHub / npm / Slack tokens
const PLATFORM_TOKEN_RE =
  /(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|npm_[A-Za-z0-9]{36}|xox[bpsar]-[A-Za-z0-9\-]+)/g;

// Private key blocks
const PRIVATE_KEY_RE = /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE KEY-----/g;

/**
 * Redact common secret patterns from file content before sending to the model.
 * Returns the content with secrets replaced by [REDACTED].
 */
export function redactSecrets(content: string): string {
  let result = content;

  // Private key blocks first (multiline)
  result = result.replace(PRIVATE_KEY_RE, `-----BEGIN PRIVATE KEY-----\n${REDACTED}\n-----END PRIVATE KEY-----`);

  // AWS keys
  result = result.replace(AWS_KEY_RE, REDACTED);

  // JWT tokens
  result = result.replace(JWT_RE, REDACTED);

  // Platform-specific tokens
  result = result.replace(PLATFORM_TOKEN_RE, REDACTED);

  // Connection strings
  result = result.replace(CONN_STRING_RE, (_match, protocol) => `${protocol}://${REDACTED}`);

  // .env values
  result = result.replace(ENV_VALUE_RE, `$1=${REDACTED}`);

  // Generic keyword-adjacent secrets
  result = result.replace(SECRET_KEYWORD_RE, `$1=${REDACTED}`);

  return result;
}
