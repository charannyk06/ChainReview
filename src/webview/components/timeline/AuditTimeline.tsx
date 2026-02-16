import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TimelineEvent } from "./TimelineEvent";
import { MILESTONE_EVENTS } from "@/lib/constants";
import type { AuditEvent } from "@/lib/types";

interface AuditTimelineProps {
  events: AuditEvent[];
  className?: string;
}

export function AuditTimeline({ events, className }: AuditTimelineProps) {
  // Filter to only meaningful milestones — drops tool_call_start/end, agent_text, pipeline_step noise
  const milestones = useMemo(
    () => events.filter((e) => MILESTONE_EVENTS.has(e.type)),
    [events]
  );

  if (milestones.length === 0) {
    return (
      <div
        className={cn(
          "h-full flex flex-col items-center justify-center gap-2",
          className
        )}
      >
        <span className="text-sm text-[var(--cr-text-secondary)]">No milestones yet</span>
        <span className="text-[11px] text-[var(--cr-text-muted)]">
          Events will appear as agents find issues and propose fixes
        </span>
      </div>
    );
  }

  // Group by type for summary header
  const counts = useMemo(() => {
    const c = { findings: 0, patches: 0, actions: 0 };
    for (const e of milestones) {
      if (e.type === "finding_emitted") c.findings++;
      else if (e.type === "patch_proposed" || e.type === "patch_validated" || e.type === "patch_generated") c.patches++;
      else if (
        e.type === "human_accepted" || e.type === "human_rejected" ||
        e.type === "false_positive_marked" || e.type === "issue_fixed" ||
        e.type === "finding_explained" || e.type === "handoff_to_agent" ||
        e.type === "validation_completed"
      ) c.actions++;
    }
    return c;
  }, [milestones]);

  return (
    <div className={cn("h-full overflow-y-auto cr-scrollbar", className)}>
      <div style={{ padding: "16px 16px 12px 16px" }}>
        {/* Summary bar */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--cr-border-subtle)]">
          <h3 className="text-[12px] font-semibold text-[var(--cr-text-muted)] uppercase tracking-wider">
            Review Timeline
          </h3>
          <div className="flex items-center gap-2 ml-auto">
            {counts.findings > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium border border-orange-500/15">
                {counts.findings} findings
              </span>
            )}
            {counts.patches > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium border border-purple-500/15">
                {counts.patches} patches
              </span>
            )}
            {counts.actions > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/15">
                {counts.actions} actions
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {milestones.map((event, i) => (
            <TimelineEvent key={event.id} event={event} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
