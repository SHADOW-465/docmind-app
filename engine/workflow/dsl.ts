// engine/workflow/dsl.ts
import type { WorkflowEdge } from '@engine/types';

const ARROW = /\s*(?:→|->)\s*/;
const GUARD_RE = /\[\s*if\s+(.+?)(?:\s*,\s*max\s+(\d+)\s+loops)?\s*\]\s*$/i;
const NODE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEdges(lines: string[]): WorkflowEdge[] {
  const out: WorkflowEdge[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    out.push(...parseLine(line));
  }
  return out;
}

function parseLine(line: string): WorkflowEdge[] {
  // Pull off an optional trailing [if ...] guard once.
  let body = line;
  let guardExpr: string | null = null;
  let maxLoops: number | undefined;
  const guardMatch = body.match(GUARD_RE);
  if (guardMatch) {
    guardExpr = guardMatch[1].trim();
    if (guardMatch[2]) maxLoops = parseInt(guardMatch[2], 10);
    body = body.slice(0, guardMatch.index).trim();
  }

  const parts = body.split(ARROW).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid edge line: "${line}" (expected "a → b")`);
  }
  for (const p of parts) {
    if (!NODE_RE.test(p)) {
      throw new Error(`Invalid node name "${p}" in edge line "${line}"`);
    }
  }

  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const isLastEdge = i === parts.length - 2;
    edges.push({
      from: parts[i],
      to: parts[i + 1],
      guard: isLastEdge && guardExpr
        ? { kind: 'predicate', expr: guardExpr }
        : { kind: 'always' },
      ...(isLastEdge && maxLoops !== undefined ? { maxLoops } : {}),
    });
  }
  return edges;
}
