import { LogInIcon, LogOutIcon, KeyIcon, CloudIcon } from "lucide-react";
import type { AuthStatePayload } from "../../lib/types";

interface AuthBannerProps {
  auth?: AuthStatePayload;
  onLogin: () => void;
  onLogout: () => void;
  onSwitchMode: () => void;
}

export function AuthBanner({ auth, onLogin, onLogout, onSwitchMode }: AuthBannerProps) {
  const isManaged = auth?.mode === "managed";
  const isAuthenticated = auth?.authenticated;
  const user = auth?.user;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        borderBottom: "1px solid var(--cr-border, rgba(255,255,255,0.08))",
        backgroundColor: "var(--cr-bg-surface, rgba(255,255,255,0.03))",
        fontSize: "11px",
        color: "var(--cr-text-muted, rgba(255,255,255,0.5))",
        gap: "8px",
        flexShrink: 0,
      }}
    >
      {/* Left: mode indicator + user info */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        {isManaged ? (
          <CloudIcon size={12} style={{ flexShrink: 0, color: "var(--cr-accent, #6366f1)" }} />
        ) : (
          <KeyIcon size={12} style={{ flexShrink: 0 }} />
        )}

        {isManaged && isAuthenticated && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name || user.email}
            </span>
            <span
              style={{
                padding: "1px 4px",
                borderRadius: "3px",
                backgroundColor: user.plan === "pro" ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                color: user.plan === "pro" ? "var(--cr-accent, #6366f1)" : "inherit",
                fontSize: "10px",
                flexShrink: 0,
              }}
            >
              {user.plan}
            </span>
          </div>
        ) : isManaged ? (
          <span>Managed mode — not signed in</span>
        ) : (
          <span>BYOK mode</span>
        )}
      </div>

      {/* Right: action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        {/* Mode switch button */}
        <button
          onClick={onSwitchMode}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            padding: "2px 6px",
            border: "1px solid var(--cr-border, rgba(255,255,255,0.1))",
            borderRadius: "3px",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            fontSize: "10px",
          }}
          title={isManaged ? "Switch to BYOK mode" : "Switch to Managed mode"}
        >
          {isManaged ? <KeyIcon size={10} /> : <CloudIcon size={10} />}
          {isManaged ? "BYOK" : "Cloud"}
        </button>

        {/* Login/Logout button */}
        {isManaged && isAuthenticated ? (
          <button
            onClick={onLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 6px",
              border: "1px solid var(--cr-border, rgba(255,255,255,0.1))",
              borderRadius: "3px",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "10px",
            }}
            title="Sign out"
          >
            <LogOutIcon size={10} />
            Sign Out
          </button>
        ) : isManaged ? (
          <button
            onClick={onLogin}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 6px",
              border: "1px solid var(--cr-accent, #6366f1)",
              borderRadius: "3px",
              background: "rgba(99,102,241,0.1)",
              color: "var(--cr-accent, #6366f1)",
              cursor: "pointer",
              fontSize: "10px",
            }}
            title="Sign in to ChainReview"
          >
            <LogInIcon size={10} />
            Sign In
          </button>
        ) : null}
      </div>
    </div>
  );
}
