import type { ChainReviewAuthProvider, ChainReviewUser } from "./auth-provider";

// ── Auth State ──
// Singleton managing authentication state across the extension.
// Tracks current mode (BYOK vs managed), user session, and JWT.
// Emits change events so the webview can stay in sync.

export type AuthMode = "byok" | "managed";

export interface AuthState {
  mode: AuthMode;
  user: ChainReviewUser | null;
  jwt: string | null;
  authenticated: boolean;
}

type AuthStateListener = (state: AuthState) => void;

const DEFAULT_STATE: AuthState = {
  mode: "byok",
  user: null,
  jwt: null,
  authenticated: false,
};

let _currentState: AuthState = { ...DEFAULT_STATE };
let _listeners: AuthStateListener[] = [];
let _authProvider: ChainReviewAuthProvider | null = null;

/** Initialize with the auth provider instance */
export function initAuthState(provider: ChainReviewAuthProvider): void {
  _authProvider = provider;
}

/** Get current auth state snapshot */
export function getAuthState(): AuthState {
  return { ..._currentState };
}

/** Subscribe to auth state changes. Returns unsubscribe function. */
export function onAuthStateChange(listener: AuthStateListener): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

/** Update auth state and notify listeners */
function _setState(partial: Partial<AuthState>): void {
  _currentState = { ..._currentState, ...partial };
  for (const listener of _listeners) {
    try {
      listener({ ..._currentState });
    } catch (err) {
      console.error("ChainReview: auth state listener error:", err);
    }
  }
}

/**
 * Switch between BYOK and managed modes.
 * In managed mode, attempts to load existing session from auth provider.
 */
export async function switchMode(mode: AuthMode): Promise<void> {
  if (mode === "byok") {
    _setState({ mode: "byok", user: null, jwt: null, authenticated: false });
    return;
  }

  // Managed mode — check for existing session
  if (_authProvider) {
    const jwt = await _authProvider.getJWT();
    const user = await _authProvider.getUser();
    _setState({
      mode: "managed",
      user,
      jwt,
      authenticated: !!jwt,
    });
  } else {
    _setState({ mode: "managed", user: null, jwt: null, authenticated: false });
  }
}

/** Called after successful login — update state with session info */
export async function onLoginSuccess(): Promise<void> {
  if (!_authProvider) return;
  const jwt = await _authProvider.getJWT();
  const user = await _authProvider.getUser();
  _setState({
    mode: "managed",
    user,
    jwt,
    authenticated: !!jwt,
  });
}

/** Called after logout — clear managed session */
export function onLogout(): void {
  _setState({
    mode: _currentState.mode, // Keep mode preference
    user: null,
    jwt: null,
    authenticated: false,
  });
}

/**
 * Refresh JWT from the auth provider.
 * Called before passing to MCP server subprocess.
 */
export async function refreshJWT(): Promise<string | null> {
  if (!_authProvider) return null;
  const jwt = await _authProvider.getJWT();
  if (jwt !== _currentState.jwt) {
    _setState({ jwt, authenticated: !!jwt });
  }
  return jwt;
}

/** Restore auth state from stored session on extension activation */
export async function restoreAuthState(): Promise<void> {
  if (!_authProvider) return;

  const jwt = await _authProvider.getJWT();
  if (jwt) {
    const user = await _authProvider.getUser();
    _setState({
      mode: "managed",
      user,
      jwt,
      authenticated: true,
    });
  }
}
