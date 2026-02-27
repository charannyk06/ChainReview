"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";
import { Sparkles, Check, AlertTriangle } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setJustUpgraded(true);
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (u) {
        setUser(u);
        setAvatarUrl(
          u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
        );

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, plan")
          .eq("id", u.id)
          .single();

        if (profile) {
          setDisplayName(profile.display_name || u.user_metadata?.full_name || "");
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          setPlan(profile.plan || "free");
        }
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setSaveError("Failed to save. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { url } = await createCheckoutSession(session.access_token);
      window.location.href = url;
    } catch (err) {
      console.error("Checkout failed:", err);
      setUpgrading(false);
    }
  }

  async function handleManageSubscription() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { url } = await createPortalSession(session.access_token);
      window.location.href = url;
    } catch (err) {
      console.error("Portal failed:", err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const isPro = plan === "pro";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Upgrade Success Banner */}
      {justUpgraded && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Welcome to Pro! Your plan has been upgraded. Enjoy unlimited tokens and priority support.
          </p>
        </div>
      )}

      {/* Profile Section */}
      <Card>
        <CardHeader bordered>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information and display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar + Email */}
            <div className="flex items-center gap-4">
              <Avatar
                size="xl"
                name={displayName || user?.email}
                src={avatarUrl}
              />
              <div>
                <div className="font-medium text-zinc-900 dark:text-white">
                  {displayName || user?.email?.split("@")[0]}
                </div>
                <div className="text-sm text-zinc-500 mt-0.5">{user?.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={isPro ? "premium" : "default"} size="sm">
                    {isPro ? "Pro" : "Free"}
                  </Badge>
                  <span className="text-xs text-zinc-400">
                    Member since{" "}
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800" />

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                value={user?.email || ""}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-sm cursor-not-allowed"
              />
              <p className="text-xs text-zinc-400 mt-1">
                Email is managed by your OAuth provider.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Your name"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving}>
                Save Changes
              </Button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <Check size={14} /> Saved
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                  <AlertTriangle size={14} /> {saveError}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Subscription Section */}
      <Card>
        <CardHeader bordered>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Manage your plan and billing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-5">
            <Badge variant={isPro ? "premium" : "default"}>
              {isPro ? "Pro" : "Free"}
            </Badge>
            <span className="text-sm text-zinc-500">
              {isPro ? "Unlimited tokens, priority support" : "100k tokens/day, 10 requests/min"}
            </span>
          </div>

          {isPro ? (
            <Button variant="outline" onClick={handleManageSubscription}>
              Manage Subscription
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 border border-brand-200 dark:border-brand-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-brand-600" />
                  <span className="text-sm font-semibold text-brand-700 dark:text-brand-400">
                    Upgrade to Pro
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-3xl font-bold text-zinc-900 dark:text-white">$29</span>
                  <span className="text-sm text-zinc-500">/month</span>
                </div>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-brand-500 shrink-0" /> 10M tokens/day
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-brand-500 shrink-0" /> 60 requests/minute
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-brand-500 shrink-0" /> Priority support
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-brand-500 shrink-0" /> Cloud review sync
                  </li>
                </ul>
              </div>
              <Button loading={upgrading} onClick={handleUpgrade} size="lg" fullWidth>
                {upgrading ? "Redirecting to Stripe..." : "Upgrade to Pro"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader bordered>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Deleting your account will permanently remove all data including usage history, API keys,
            and review data. This action cannot be undone.
          </p>
          <Button
            variant="danger"
            onClick={() => {
              alert("Please contact support@chainreview.dev to delete your account.");
            }}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
