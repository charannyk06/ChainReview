import * as vscode from "vscode";

// ── Supabase Auth Configuration ──
// SUPABASE_URL and SUPABASE_ANON_KEY are intentionally public — these are
// Supabase's client-side "anon" credentials, designed to be embedded in
// client code (VS Code extensions, web apps, mobile apps).
// They are protected by Supabase Row Level Security (RLS) policies.
//
// ⚠️  NEVER embed the service_role key here — that belongs in .dev.vars
//     (which is gitignored) and deployed as a Cloudflare Workers secret.
const SUPABASE_URL = "https://aztyzfxiiplydnhollev.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dHl6ZnhpaXBseWRuaG9sbGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDkzOTgsImV4cCI6MjA4NzAyNTM5OH0.9MEEVUN4fY8F895xthqWQDIusziG5FhFl3qvCxBORW8";

export const AUTH_PROVIDER_ID = "chainreview";
const AUTH_PROVIDER_LABEL = "ChainReview";
const SESSIONS_SECRET_KEY = "chainreview.auth.sessions";

export interface ChainReviewUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: string;
}

export interface ChainReviewSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  user: ChainReviewUser;
}

/**
 * VS Code AuthenticationProvider for ChainReview managed mode.
 *
 * Flow:
 * 1. User clicks "Sign In" → we open the Supabase auth page in browser
 * 2. After OAuth/email login, Supabase redirects to vscode://chainreview.chainreview/callback
 * 3. URI handler captures the tokens from the redirect
 * 4. We store the refresh token in VS Code SecretStorage
 * 5. JWT is refreshed automatically before expiry
 */
export class ChainReviewAuthProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  private _sessionChangeEmitter =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._sessionChangeEmitter.event;

  private _disposables: vscode.Disposable[] = [];
  private _session: ChainReviewSession | null = null;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingLogin: {
    resolve: (session: ChainReviewSession) => void;
    reject: (err: Error) => void;
  } | null = null;

  constructor(private readonly _secrets: vscode.SecretStorage) {
    this._disposables.push(this._sessionChangeEmitter);
  }

  // ── AuthenticationProvider interface ──

  async getSessions(
    _scopes?: readonly string[]
  ): Promise<vscode.AuthenticationSession[]> {
    const session = await this._getStoredSession();
    if (!session) return [];

    return [this._toVSCodeSession(session)];
  }

  async createSession(
    _scopes: readonly string[]
  ): Promise<vscode.AuthenticationSession> {
    const session = await this._login();
    return this._toVSCodeSession(session);
  }

  async removeSession(sessionId: string): Promise<void> {
    const session = await this._getStoredSession();
    if (session && this._toVSCodeSession(session).id === sessionId) {
      await this._clearSession();
      this._sessionChangeEmitter.fire({
        added: [],
        removed: [this._toVSCodeSession(session)],
        changed: [],
      });
    }
  }

  // ── Public API ──

  /** Get the current JWT for API calls, or null if not authenticated */
  async getJWT(): Promise<string | null> {
    const session = await this._getStoredSession();
    if (!session) return null;

    // Auto-refresh if expired or about to expire (60s buffer)
    if (Date.now() / 1000 > session.expiresAt - 60) {
      try {
        const refreshed = await this._refreshSession(session.refreshToken);
        return refreshed.accessToken;
      } catch {
        await this._clearSession();
        return null;
      }
    }

    return session.accessToken;
  }

  /** Get the current user profile */
  async getUser(): Promise<ChainReviewUser | null> {
    const session = await this._getStoredSession();
    return session?.user ?? null;
  }

  /** Check if user is currently authenticated */
  async isAuthenticated(): Promise<boolean> {
    return (await this.getJWT()) !== null;
  }

  /**
   * Handle the OAuth callback URI from the browser redirect.
   * Called by the URI handler registered in extension.ts.
   */
  async handleCallback(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = parseInt(params.get("expires_in") || "3600", 10);

    // Also check fragment (Supabase sometimes returns tokens in fragment)
    const fragment = uri.fragment;
    let fragAccessToken: string | null = null;
    let fragRefreshToken: string | null = null;
    let fragExpiresIn = 3600;
    if (fragment) {
      const fragParams = new URLSearchParams(fragment);
      fragAccessToken = fragParams.get("access_token");
      fragRefreshToken = fragParams.get("refresh_token");
      fragExpiresIn = parseInt(fragParams.get("expires_in") || "3600", 10);
    }

    const finalAccessToken = accessToken || fragAccessToken;
    const finalRefreshToken = refreshToken || fragRefreshToken;
    const finalExpiresIn = accessToken ? expiresIn : fragExpiresIn;

    if (!finalAccessToken || !finalRefreshToken) {
      const error = params.get("error_description") || params.get("error") || "No tokens received";
      this._pendingLogin?.reject(new Error(`Auth failed: ${error}`));
      this._pendingLogin = null;
      return;
    }

    // Decode JWT to get user info (JWT payload is base64url-encoded)
    const user = this._parseJWTUser(finalAccessToken);

    const session: ChainReviewSession = {
      accessToken: finalAccessToken,
      refreshToken: finalRefreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + finalExpiresIn,
      user,
    };

    await this._storeSession(session);
    this._scheduleRefresh(session);

    this._sessionChangeEmitter.fire({
      added: [this._toVSCodeSession(session)],
      removed: [],
      changed: [],
    });

    this._pendingLogin?.resolve(session);
    this._pendingLogin = null;

    vscode.window.showInformationMessage(
      `ChainReview: Signed in as ${user.name || user.email}`
    );
  }

  dispose(): void {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._disposables.forEach((d) => d.dispose());
  }

  // ── Private helpers ──

  private async _login(): Promise<ChainReviewSession> {
    // Open browser with Supabase auth URL
    const redirectUri = `${vscode.env.uriScheme}://chainreview.chainreview/callback`;
    const authUrl =
      `${SUPABASE_URL}/auth/v1/authorize?` +
      `provider=github&` +
      `redirect_to=${encodeURIComponent(redirectUri)}`;

    await vscode.env.openExternal(vscode.Uri.parse(authUrl));

    // Wait for the callback
    return new Promise<ChainReviewSession>((resolve, reject) => {
      this._pendingLogin = { resolve, reject };

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this._pendingLogin) {
          this._pendingLogin.reject(new Error("Login timed out"));
          this._pendingLogin = null;
        }
      }, 5 * 60 * 1000);
    });
  }

  private async _refreshSession(
    refreshToken: string
  ): Promise<ChainReviewSession> {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user?: { id: string; email: string; user_metadata?: Record<string, unknown> };
    };

    const user = this._parseJWTUser(data.access_token);
    const session: ChainReviewSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      user,
    };

    await this._storeSession(session);
    this._scheduleRefresh(session);

    this._sessionChangeEmitter.fire({
      added: [],
      removed: [],
      changed: [this._toVSCodeSession(session)],
    });

    return session;
  }

  private _scheduleRefresh(session: ChainReviewSession): void {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);

    // Refresh 60 seconds before expiry
    const msUntilRefresh = (session.expiresAt - 60) * 1000 - Date.now();
    if (msUntilRefresh > 0) {
      this._refreshTimer = setTimeout(async () => {
        try {
          await this._refreshSession(session.refreshToken);
        } catch (err: any) {
          console.error("ChainReview: Auto-refresh failed:", err.message);
          await this._clearSession();
        }
      }, msUntilRefresh);
    }
  }

  private async _getStoredSession(): Promise<ChainReviewSession | null> {
    if (this._session) return this._session;

    const raw = await this._secrets.get(SESSIONS_SECRET_KEY);
    if (!raw) return null;

    try {
      const session = JSON.parse(raw) as ChainReviewSession;
      this._session = session;
      this._scheduleRefresh(session);
      return session;
    } catch {
      return null;
    }
  }

  private async _storeSession(session: ChainReviewSession): Promise<void> {
    this._session = session;
    await this._secrets.store(SESSIONS_SECRET_KEY, JSON.stringify(session));
  }

  private async _clearSession(): Promise<void> {
    this._session = null;
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    await this._secrets.delete(SESSIONS_SECRET_KEY);
  }

  private _parseJWTUser(jwt: string): ChainReviewUser {
    try {
      const payload = JSON.parse(
        Buffer.from(jwt.split(".")[1], "base64url").toString()
      );
      return {
        id: payload.sub || "",
        email: payload.email || "",
        name:
          payload.user_metadata?.full_name ||
          payload.user_metadata?.name ||
          payload.email?.split("@")[0] ||
          "",
        avatarUrl: payload.user_metadata?.avatar_url || undefined,
        plan: payload.user_metadata?.plan || "free",
      };
    } catch {
      return { id: "", email: "", name: "", plan: "free" };
    }
  }

  private _toVSCodeSession(
    session: ChainReviewSession
  ): vscode.AuthenticationSession {
    return {
      id: `chainreview-${session.user.id}`,
      accessToken: session.accessToken,
      account: {
        id: session.user.id,
        label: session.user.name || session.user.email,
      },
      scopes: ["profile", "email"],
    };
  }
}
