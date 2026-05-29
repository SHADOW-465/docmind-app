// engine/primitives/trace.ts
import { insertTraceEvent, type NewTraceEvent } from '@engine/storage/trace';

/**
 * The trace "primitive" is special: it doesn't appear in WorkflowGraph nodes.
 * It is the sink called by every other primitive (and by the runtime) to
 * record what happened. Kept in primitives/ for proximity to its callers.
 */
export async function writeTrace(event: NewTraceEvent): Promise<void> {
  await insertTraceEvent(event);
}
