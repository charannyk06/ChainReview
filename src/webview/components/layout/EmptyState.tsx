import { FolderSearchIcon, GitCompareArrowsIcon, ClockIcon, MessageCircleIcon, LogInIcon, LogOutIcon, KeyIcon, CloudIcon, UserIcon, GitPullRequestIcon } from "lucide-react";
import type { AuthStatePayload } from "../../lib/types";

interface EmptyStateProps {
  onStartRepoReview: () => void;
  onStartDiffReview: () => void;
  onStartChat?: () => void;
  onOpenHistory?: () => void;
  onStartAzurePRReview?: () => void;
  auth?: AuthStatePayload;
  onLogin?: () => void;
  onLogout?: () => void;
  onSwitchMode?: () => void;
}

/* ChainReview logo — code brackets with chain links (large) */
function ChainReviewLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10 7L4 16L10 25" stroke="#e4e4e7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 7L28 16L22 25" stroke="#e4e4e7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 9L13 23" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* Anthropic logo */
function AnthropicIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27.02 0h5.868L46 32h-5.868L27.02 0Z" fill="#52525b" />
      <path d="M13.112 0H7.244L0 32h5.868l2.35-10.404h10.14L20.708 32h5.868L13.112 0Zm-3.16 16.096L13.112 4.8l3.16 11.296H9.952Z" fill="#52525b" />
    </svg>
  );
}

export function EmptyState({
  onStartRepoReview,
  onStartDiffReview,
  onStartChat,
  onOpenHistory,
  onStartAzurePRReview,
  auth,
  onLogin,
  onLogout,
  onSwitchMode,
}: EmptyStateProps) {
  const isManaged = auth?.mode === "managed";
  const isAuthenticated = auth?.authenticated;
  const user = auth?.user;
  const showSignUp = isManaged && !isAuthenticated;
  const showUserInfo = isManaged && isAuthenticated && user;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px 20px",
        background: "#09090b",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Very subtle radial glow */}
      <div
        style={{
          position: "absolute",
          top: "28%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(228,228,231,0.015) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, position: "relative", zIndex: 1, width: "100%", maxWidth: 300 }}>

        {/* Logo + title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <ChainReviewLogo size={44} />
            <div style={{
              position: "absolute",
              bottom: -2,
              right: -4,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#22c55e",
              border: "2px solid #09090b",
            }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <h1 style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#e4e4e7",
              letterSpacing: "-0.03em",
              margin: 0,
              lineHeight: 1.2,
            }}>
              ChainReview
            </h1>
            <p style={{
              fontSize: 12,
              color: "#52525b",
              marginTop: 5,
              fontWeight: 500,
            }}>
              Multi-agent AI code reviewer
            </p>
          </div>
        </div>

        {/* ── Auth section (sign up / user info) ── */}
        {showSignUp && (
          <div style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid #27272a",
            background: "#18181b",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e4e4e7" }}>Sign in to ChainReview</span>
              <span style={{ fontSize: 11, color: "#52525b" }}>Save reviews, sync across machines, manage API keys in the cloud.</span>
            </div>
            <button
              onClick={onLogin}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #3f3f46",
                background: "#27272a",
                color: "#e4e4e7",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#3f3f46";
                e.currentTarget.style.borderColor = "#52525b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#27272a";
                e.currentTarget.style.borderColor = "#3f3f46";
              }}
            >
              <LogInIcon size={13} />
              Sign in / Create account
            </button>
            {onSwitchMode && (
              <button
                onClick={onSwitchMode}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "transparent",
                  border: "none",
                  color: "#52525b",
                  fontSize: 11,
                  cursor: "pointer",
                  padding: "2px 0",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#a1a1aa"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#52525b"; }}
              >
                <KeyIcon size={10} />
                Use your own API key instead
              </button>
            )}
          </div>
        )}

        {/* Signed-in user info card */}
        {showUserInfo && (
          <div style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid #27272a",
            background: "#18181b",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: "50%", display: "block", border: "1px solid #3f3f46" }}
                  onError={(e) => {
                    // Fallback to initials avatar on load failure
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "#27272a", border: "1px solid #3f3f46",
                display: user.avatarUrl ? "none" : "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#a1a1aa",
              }}>
                {(user.name || user.email || "?").charAt(0).toUpperCase()}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name || user.email}
              </div>
              <div style={{ fontSize: 10, color: "#52525b", marginTop: 1 }}>
                {user.plan === "pro" ? "Pro plan" : "Free plan"} · Cloud mode
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "1px solid #27272a",
                  borderRadius: 6,
                  color: "#52525b",
                  fontSize: 10,
                  cursor: "pointer",
                  padding: "4px 7px",
                  flexShrink: 0,
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#3f3f46";
                  e.currentTarget.style.color = "#a1a1aa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#27272a";
                  e.currentTarget.style.color = "#52525b";
                }}
              >
                <LogOutIcon size={10} />
                Sign out
              </button>
            )}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {/* Review Repository — Primary */}
          <button
            onClick={onStartRepoReview}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              width: "100%",
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #3f3f46",
              background: "#27272a",
              color: "#e4e4e7",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#3f3f46";
              e.currentTarget.style.borderColor = "#52525b";
              e.currentTarget.style.color = "#fafafa";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#27272a";
              e.currentTarget.style.borderColor = "#3f3f46";
              e.currentTarget.style.color = "#e4e4e7";
            }}
          >
            <FolderSearchIcon style={{ width: 15, height: 15 }} />
            Review Repository
          </button>

          {/* Review Diff */}
          <button
            onClick={onStartDiffReview}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              width: "100%",
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #27272a",
              background: "#18181b",
              color: "#71717a",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1f1f22";
              e.currentTarget.style.borderColor = "#3f3f46";
              e.currentTarget.style.color = "#a1a1aa";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#18181b";
              e.currentTarget.style.borderColor = "#27272a";
              e.currentTarget.style.color = "#71717a";
            }}
          >
            <GitCompareArrowsIcon style={{ width: 15, height: 15 }} />
            Review Diff
          </button>

          {/* Azure PR Review */}
          {onStartAzurePRReview && (
            <button
              onClick={onStartAzurePRReview}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                width: "100%",
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #27272a",
                background: "#18181b",
                color: "#71717a",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1f1f22";
                e.currentTarget.style.borderColor = "#3f3f46";
                e.currentTarget.style.color = "#a1a1aa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#18181b";
                e.currentTarget.style.borderColor = "#27272a";
                e.currentTarget.style.color = "#71717a";
              }}
            >
              <GitPullRequestIcon style={{ width: 15, height: 15 }} />
              Review Azure PR
            </button>
          )}

          {/* Ask */}
          {onStartChat && (
            <button
              onClick={onStartChat}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                width: "100%",
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #27272a",
                background: "#18181b",
                color: "#71717a",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1f1f22";
                e.currentTarget.style.borderColor = "#3f3f46";
                e.currentTarget.style.color = "#a1a1aa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#18181b";
                e.currentTarget.style.borderColor = "#27272a";
                e.currentTarget.style.color = "#71717a";
              }}
            >
              <MessageCircleIcon style={{ width: 15, height: 15 }} />
              Ask
            </button>
          )}
        </div>

        {/* History + BYOK mode switch (when logged in) */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "#3f3f46",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "color 150ms ease",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#71717a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#3f3f46"; }}
            >
              <ClockIcon style={{ width: 12, height: 12 }} />
              Past reviews
            </button>
          )}
          {/* Mode switch when in BYOK mode */}
          {!isManaged && onSwitchMode && (
            <button
              onClick={onSwitchMode}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "#3f3f46",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "color 150ms ease",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#71717a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#3f3f46"; }}
            >
              <CloudIcon style={{ width: 12, height: 12 }} />
              Cloud mode
            </button>
          )}
        </div>

        {/* Version + Powered by */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 9,
          color: "#27272a",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}>
          <span>v0.1.0</span>
          <span>&middot;</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            Powered by <AnthropicIcon size={10} /> Claude Opus 4.6
          </span>
        </div>
      </div>
    </div>
  );
}
