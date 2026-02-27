"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  getUsageSummary,
  getUsageHistory,
  getReviews,
  type UsageSummary,
  type DailyUsage,
  type CloudReviewRun,
} from "@/lib/api";
import { UsageChart } from "@/components/charts/UsageChart";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCard, SkeletonChart } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Zap,
  BarChart3,
  TrendingUp,
  Shield,
  FileSearch,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

const SEVERITY_VARIANT: Record<string, "error" | "warning" | "info" | "default"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "info",
  info: "default",
};

export default function DashboardOverview() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<DailyUsage[]>([]);
  const [reviews, setReviews] = useState<CloudReviewRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      try {
        const [usageData, historyData, reviewsData] = await Promise.allSettled([
          getUsageSummary(token),
          getUsageHistory(token, 14),
          getReviews(token, 5),
        ]);

        if (usageData.status === "fulfilled") setUsage(usageData.value);
        if (historyData.status === "fulfilled") setHistory(historyData.value.days);
        if (reviewsData.status === "fulfilled") setReviews(reviewsData.value.reviews);
      } catch (err) {
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonChart />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load dashboard"
          description={error}
          action={
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Retry
            </button>
          }
        />
      </Card>
    );
  }

  const todayTokens = (usage?.today.inputTokens || 0) + (usage?.today.outputTokens || 0);
  const monthTokens = (usage?.month.inputTokens || 0) + (usage?.month.outputTokens || 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Zap}
          label="Today's Tokens"
          value={todayTokens.toLocaleString()}
          iconColor="text-brand-500"
          subtitle={`${(usage?.today.inputTokens || 0).toLocaleString()} in / ${(usage?.today.outputTokens || 0).toLocaleString()} out`}
        />
        <StatCard
          icon={BarChart3}
          label="Today's Requests"
          value={(usage?.today.requests || 0).toLocaleString()}
          iconColor="text-cyan-500"
        />
        <StatCard
          icon={TrendingUp}
          label="This Month"
          value={monthTokens >= 1_000_000 ? `${(monthTokens / 1_000_000).toFixed(1)}M` : monthTokens.toLocaleString()}
          iconColor="text-emerald-500"
          subtitle={`${(usage?.month.requests || 0).toLocaleString()} requests`}
        />
        <StatCard
          icon={Shield}
          label="Current Plan"
          value={(usage?.plan || "free").charAt(0).toUpperCase() + (usage?.plan || "free").slice(1)}
          iconColor="text-amber-500"
          subtitle={usage?.plan === "pro" ? "Unlimited tokens" : "100k tokens/day"}
        />
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader bordered>
          <div className="flex items-center justify-between">
            <CardTitle>Token Usage (14 days)</CardTitle>
            <Link
              href="/dashboard/usage"
              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
            >
              View details <ArrowRight size={12} />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <UsageChart data={history} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No usage data yet"
              description="Start using ChainReview to see your token usage over time."
              className="py-12"
            />
          )}
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader bordered>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Reviews</CardTitle>
            <Link
              href="/dashboard/reviews"
              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reviews.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {reviews.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20 shrink-0">
                      <FileSearch size={14} className="text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                        {run.repo_name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {run.mode} &middot; {(run.duration_ms / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      {Object.entries(run.severity_breakdown || {}).map(([sev, count]) => (
                        <Badge key={sev} variant={SEVERITY_VARIANT[sev] || "default"} size="sm">
                          {count} {sev}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileSearch}
              title="No reviews synced yet"
              description="Enable review syncing in VS Code to see your review history here."
              className="py-12"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
