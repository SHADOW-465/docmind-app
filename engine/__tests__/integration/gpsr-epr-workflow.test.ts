import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { gpsrEprWorkflow } from '../../workflows/gpsr-epr.workflow';

const RUN_INTEGRATION =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.AI_GATEWAY_API_KEY;

describe.skipIf(!RUN_INTEGRATION)('gpsr-epr workflow end-to-end', () => {
  let workspaceId: string;
  let fileBuffer: Buffer;

  beforeAll(async () => {
    const { createWorkspace } = await import('@engine/storage/workspace');
    fileBuffer = await fs.readFile(path.resolve(__dirname, '../fixtures/usb-charger-spec.txt'));
    const ws = await createWorkspace({
      workflowId: gpsrEprWorkflow.id,
      rulesPackId: 'eu-gpsr-epr',
      rulesPackVersion: '2026.05.0',
    });
    workspaceId = ws.id;
  }, 30_000);

  it('produces three artifacts (WEEE + packaging + GPSR notice) and a trace per node', async () => {
    const { runWorkflow } = await import('@engine/workflow/runtime');
    const out = await runWorkflow({
      graph: gpsrEprWorkflow,
      workspaceId,
      startNode: 'ingest',
      nodeInputs: {
        ingest: {
          file: { buffer: fileBuffer, filename: 'usb-charger-spec.txt', mime: 'text/plain' },
        },
      },
    });

    expect(out.finalNode).toBe('emit');
    expect(out.results.every((r) => r.result.ok)).toBe(true);

    const { createServerClient } = await import('@/lib/supabase-server');
    const supabase = createServerClient();

    const { data: arts } = await supabase
      .from('eng_artifacts')
      .select('type, value, status, emitted_format')
      .eq('workspace_id', workspaceId);
    expect(arts?.length).toBeGreaterThanOrEqual(3);
    const types = arts!.map((a) => a.type).sort();
    expect(types).toEqual(expect.arrayContaining(['EprRegistrationDe', 'EprRegistrationDe', 'GpsrSafetyNotice']));
    expect(arts!.every((a) => a.status === 'emitted' && a.emitted_format === 'json')).toBe(true);

    const { data: traces } = await supabase
      .from('eng_trace_events')
      .select('primitive')
      .eq('workspace_id', workspaceId);
    const primitives = new Set(traces!.map((t) => t.primitive));
    for (const p of ['ingest','classify','extract','lookup','reason','draft','validate','hitl','emit']) {
      expect(primitives.has(p), `missing trace for ${p}`).toBe(true);
    }

    const hasAcme = arts!.some((a) => JSON.stringify(a.value).includes('Acme GmbH'));
    expect(hasAcme).toBe(true);
  }, 120_000);
});
