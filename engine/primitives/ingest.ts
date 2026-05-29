// engine/primitives/ingest.ts
import { extractFromBuffer } from '@/lib/extractor';
import { insertSource } from '@engine/storage/workspace';
import { writeTrace } from '@engine/primitives/trace';
import { ok, fail } from '@engine/result';
import type { PrimitiveResult, Source } from '@engine/types';

export interface IngestInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  file: { buffer: Buffer; filename: string; mime: string };
  storageUrl?: string | null;
}

export interface IngestOutput {
  source: Source;
}

export async function ingestPrimitive(input: IngestInput): Promise<PrimitiveResult<IngestOutput>> {
  const t0 = Date.now();
  try {
    const extraction = await extractFromBuffer(input.file.buffer, input.file.filename);
    const source = await insertSource({
      workspaceId: input.workspaceId,
      filename: input.file.filename,
      mime: input.file.mime,
      storageUrl: input.storageUrl ?? null,
      typedRep: {
        text: extraction.text,
        pageCount: extraction.pageCount,
        fileType: extraction.fileType,
      },
      isLarge: extraction.isLarge,
    });
    const result = ok({ source } as IngestOutput, { confidence: 1.0 });
    await writeTrace({
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId,
      nodeId: input.nodeId,
      primitive: 'ingest',
      inputs: { filename: input.file.filename, mime: input.file.mime, bytes: input.file.buffer.length },
      output: { sourceId: source.id, fileType: source.typedRep.fileType, pageCount: source.typedRep.pageCount },
      model: null,
      confidence: result.confidence,
      latencyMs: Date.now() - t0,
      costUsd: null,
      reviewer: null,
    });
    return result;
  } catch (err) {
    const failure = fail<IngestOutput>('E_INGEST', (err as Error).message);
    await writeTrace({
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId,
      nodeId: input.nodeId,
      primitive: 'ingest',
      inputs: { filename: input.file.filename },
      output: { error: (err as Error).message },
      model: null,
      confidence: 0,
      latencyMs: Date.now() - t0,
      costUsd: null,
      reviewer: null,
    });
    return failure;
  }
}
