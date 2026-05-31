// engine/storage/entities.ts
import { createServerClient } from '@/lib/supabase-server';
import type { CanonicalEntity, CitationAnchor } from '@engine/types';

export async function insertEntity(input: {
  workspaceId: string;
  type: string;
  value: Record<string, unknown>;
  citations: CitationAnchor[];
}): Promise<CanonicalEntity> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_canonical_entities')
    .insert({
      workspace_id: input.workspaceId,
      type: input.type,
      value: input.value,
      citations: input.citations,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insertEntity failed: ${error?.message}`);
  return rowToEntity(data);
}

export async function listEntities(
  workspaceId: string,
  type?: string,
): Promise<CanonicalEntity[]> {
  const supabase = createServerClient();
  const base = supabase.from('eng_canonical_entities').select().eq('workspace_id', workspaceId);
  const { data, error } = type ? await base.eq('type', type) : await base;
  if (error) throw new Error(`listEntities failed: ${error.message}`);
  return (data ?? []).map(rowToEntity);
}

type EntityRow = {
  id: string; workspace_id: string; type: string;
  value: Record<string, unknown>; citations: CitationAnchor[];
};

function rowToEntity(r: EntityRow): CanonicalEntity {
  return {
    id: r.id, workspaceId: r.workspace_id, type: r.type,
    value: r.value, citations: r.citations,
  };
}
