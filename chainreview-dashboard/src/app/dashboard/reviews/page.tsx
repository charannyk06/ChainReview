"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { getReviews, type CloudReviewRun } from "@/lib/api";
import { DataTable, type ColumnDef } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertCircle, FileSearch, Clock, GitBranch } from "lucide-react";

const SEVERITY_VARIANT: Record<string, "error" | "warning" | "info" | "default"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "info",
  info: "default",
};

const MODE_VARIANT: Record<string, "info" | "premium" | "default"> = {
  full: "premium",
  quick: "info",
  diff: "default",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<CloudReviewRun[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const data = await getReviews(session.access_token, limit, offset);
        setReviews(data.reviews);
        setTotal(data.total);
      } catch (err) {
        setError("Failed to load reviews. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase, offset]);

  const columns: ColumnDef<CloudReviewRun>[] = useMemo(
    () => [
      {
        key: "repo_name",
        header: "Repository",
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
              <GitBranch size={14} className="text-zinc-500" />
            </div>
            <span className="font-medium text-zinc-900 dark:text-white truncate max-w-[200px]">
              {row.repo_name}
            </span>
          </div>
        ),
      },
      {
        key: "mode",
        header: "Mode",
        render: (row) => (
          <Badge variant={MODE_VARIANT[row.mode] || "default"} size="sm">
            {row.mode}
          </Badge>
        ),
      },
      {
        key: "findings_count",
        header: "Findings",
        sortable: true,
        render: (row) => (
          <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-white">
            {row.findings_count}
          </span>
        ),
      },
      {
        key: "severity",
        header: "Severity",
        render: (row) => (
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(row.severity_breakdown || {}).map(([sev, count]) => (
              <Badge key={sev} variant={SEVERITY_VARIANT[sev] || "default"} size="sm">
                {count} {sev}
              </Badge>
            ))}
            {(!row.severity_breakdown || Object.keys(row.severity_breakdown).length === 0) && (
              <span className="text-xs text-zinc-400">--</span>
            )}
          </div>
        ),
      },
      {
        key: "duration",
        header: "Duration",
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <Clock size={13} className="shrink-0" />
            <span className="tabular-nums">{(row.duration_ms / 1000).toFixed(1)}s</span>
          </div>
        ),
      },
      {
        key: "created_at",
        header: "Date",
        sortable: true,
        render: (row) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {new Date(row.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      },
    ],
    [],
  );

  if (error && !loading) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load reviews"
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

  return (
    <div className="space-y-6">
      <DataTable
        columns={columns}
        data={reviews}
        rowKey={(r) => r.id}
        total={total}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset(Math.max(0, offset - limit))}
        onNext={() => setOffset(offset + limit)}
        loading={loading}
        emptyTitle="No reviews synced yet"
        emptyDescription="Enable review syncing in VS Code: Settings > ChainReview > Sync Reviews"
      />
    </div>
  );
}
