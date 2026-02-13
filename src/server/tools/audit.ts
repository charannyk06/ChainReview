import type { Store } from "../store";
import type { AgentName, EventType } from "../types";

// ── crp.review.record_event ──

export async function recordEvent(
  args: {
    runId: string;
    type: EventType;
    agent?: AgentName;
    data: Record<string, unknown>;
  },
  store: Store
): Promise<{ eventId: string; timestamp: string }> {
  const timestamp = new Date().toISOString();
  const eventId = store.insertEvent(args.runId, args.type, args.agent, args.data);

  return { eventId, timestamp };
}
