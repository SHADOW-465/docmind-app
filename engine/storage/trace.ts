// engine/storage/trace.ts
import { createServerClient } from '@/lib/supabase-server';
import type { TraceEvent } from '@engine/types';

export type NewTraceEvent = Omit<TraceEvent, 'id' | 'createdAt'>;

export async function insertTraceEvent(event: NewTraceEvent): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('eng_trace_events').insert({
    workspace_id: event.workspaceId,
    workflow_run_id: event.workflowRunId,
    node_id: event.nodeId,
    primitive: event.primitive,
    inputs: event.inputs,
    output: event.output,
    model: event.model,
    confidence: event.confidence,
    latency_ms: event.latencyMs,
    cost_usd: event.costUsd,
    reviewer: event.reviewer,
  });
  if (error) {
    // Trace writes must never crash the workflow. Log and continue.
    console.error('[trace] insert failed:', error.message);
  }
}
