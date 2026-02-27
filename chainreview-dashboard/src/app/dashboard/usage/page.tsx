"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  getUsageSummary,
  getUsageHistory,
  type UsageSummary,
  type DailyUsage,
} from "@/lib/api";
import { UsageChart } from "@/components/charts/UsageChart";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCard, SkeletonChart } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { clsx } from "clsx";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Gauge,
  BarChart3,
  AlertCircle,
} from "lucide-react";

const PLAN_LIMITS: Record<string, { tokensPerDay: number; requestsPerMinute: number }> = {
  free: { tokensPerDay: 100_000, requestsPerMinute: 10 },
  pro: { tokensPerDay: 10_000_000, requestsPerMinute: 60 },
};

const COST_PER_M_INPUT = 15;
const COST_PER_M_OUTPUT = 75;

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<DailyUsage[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      try {
        const [usageData, historyData] = await Promise.all([
          getUsageSummary(token),
          getUsageHistory(token, days),
        ]);
        setUsage(usageData);
        setHistory(historyData.days);
      } catch (err) {
        setError("Failed to load usage data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase, days]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonChart />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load usage"
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

  const plan = usage?.plan || "free";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const todayTotal = (usage?.today.inputTokens || 0) + (usage?.today.outputTokens || 0);
  const todayPercent = Math.min((todayTotal / limits.tokensPerDay) * 100, 100);

  const monthCostEstimate =
    ((usage?.month.inputTokens || 0) / 1_000_000) * COST_PER_M_INPUT +
    ((usage?.month.outputTokens || 0) / 1_000_000) * COST_PER_M_OUTPUT;

  return (
    <div className="space-y-6">
      {/* Today's Usage Progress */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-brand-500" />
              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                Today&apos;s Token Usage
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300 font-medium">
                {todayTotal.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400">/</span>
              <span className="text-xs text-zinc-500">
                {limits.tokensPerDay.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-3">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                todayPercent >= 90
                  ? "bg-red-500"
                  : todayPercent >= 70
                    ? "bg-amber-500"
                    : "bg-brand-500",
              )}
              style={{ width: `${todayPercent}%` }}
            />
          </div>

          <div className="flex justify-between mt-2.5 text-xs text-zinc-500">
            <span>
              Input: <span className="font-medium text-zinc-700 dark:text-zinc-300">{(usage?.today.inputTokens || 0).toLocaleString()}</span>
            </span>
            <span>
              Output: <span className="font-medium text-zinc-700 dark:text-zinc-300">{(usage?.today.outputTokens || 0).toLocaleString()}</span>
            </span>
            <span>
              Requests: <span className="font-medium text-zinc-700 dark:text-zinc-300">{usage?.today.requests || 0}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={ArrowDownToLine}
          label="Monthly Input"
          value={(usage?.month.inputTokens || 0).toLocaleString()}
          iconColor="text-indigo-500"
          subtitle="tokens"
        />
        <StatCard
          icon={ArrowUpFromLine}
          label="Monthly Output"
          value={(usage?.month.outputTokens || 0).toLocaleString()}
          iconColor="text-cyan-500"
          subtitle="tokens"
        />
        <StatCard
          icon={DollarSign}
          label="Est. Monthly Cost"
          value={`$${monthCostEstimate.toFixed(2)}`}
          iconColor="text-emerald-500"
          subtitle="Based on Opus pricing"
        />
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader bordered>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>Token usage over time</CardDescription>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <UsageChart data={history} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No usage data"
              description="Your daily token usage will appear here once you start using ChainReview."
              className="py-12"
            />
          )}
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader bordered>
          <div className="flex items-center gap-2">
            <CardTitle>Rate Limits</CardTitle>
            <Badge variant={plan === "pro" ? "premium" : "default"}>
              {plan === "pro" ? "Pro" : "Free"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Requests per minute
              </span>
              <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
                {limits.requestsPerMinute}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Tokens per day
              </span>
              <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
                {limits.tokensPerDay.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
