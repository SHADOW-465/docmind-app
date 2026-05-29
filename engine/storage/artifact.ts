// engine/storage/artifact.ts
import { createServerClient } from '@/lib/supabase-server';
import type { Artifact, ArtifactStatus } from '@engine/types';

export async function insertArtifact(input: {
  workspaceId: string;
  type: string;
  schemaId: string;
  value: Record<string, unknown>;
}): Promise<Artifact> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_artifacts')
    .insert({
      workspace_id: input.workspaceId,
      type: input.type,
      schema_id: input.schemaId,
      value: input.value,
      status: 'draft' satisfies ArtifactStatus,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insertArtifact failed: ${error?.message}`);
  return rowToArtifact(data);
}

export async function updateArtifact(
  id: string,
  patch: Partial<Pick<Artifact, 'value' | 'status' | 'emittedFormat' | 'emittedUrl'>>,
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('eng_artifacts')
    .update({
      ...(patch.value !== undefined && { value: patch.value }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.emittedFormat !== undefined && { emitted_format: patch.emittedFormat }),
      ...(patch.emittedUrl !== undefined && { emitted_url: patch.emittedUrl }),
    })
    .eq('id', id);
  if (error) throw new Error(`updateArtifact failed: ${error.message}`);
}

export async function listArtifacts(workspaceId: string): Promise<Artifact[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_artifacts').select().eq('workspace_id', workspaceId);
  if (error) throw new Error(`listArtifacts failed: ${error.message}`);
  return (data ?? []).map(rowToArtifact);
}

type ArtifactRow = {
  id: string; workspace_id: string; type: string; schema_id: string;
  value: Record<string, unknown>; status: ArtifactStatus;
  emitted_format: string | null; emitted_url: string | null;
};

function rowToArtifact(r: ArtifactRow): Artifact {
  return {
    id: r.id, workspaceId: r.workspace_id, type: r.type, schemaId: r.schema_id,
    value: r.value, status: r.status,
    emittedFormat: r.emitted_format, emittedUrl: r.emitted_url,
  };
}
