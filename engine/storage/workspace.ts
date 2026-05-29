// engine/storage/workspace.ts
import { createServerClient } from '@/lib/supabase-server';
import type { Workspace, Source, WorkspaceStatus, TypedRep } from '@engine/types';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export async function createWorkspace(input: {
  workflowId: string;
  rulesPackId: string;
  rulesPackVersion: string;
  orgId?: string;
  ownerId?: string | null;
}): Promise<Workspace> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_workspaces')
    .insert({
      org_id: input.orgId ?? DEFAULT_ORG_ID,
      owner_id: input.ownerId ?? null,
      workflow_id: input.workflowId,
      rules_pack_id: input.rulesPackId,
      rules_pack_version: input.rulesPackVersion,
      status: 'open' satisfies WorkspaceStatus,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createWorkspace failed: ${error?.message}`);
  return rowToWorkspace(data);
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_workspaces')
    .select()
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getWorkspace failed: ${error.message}`);
  return data ? rowToWorkspace(data) : null;
}

export async function updateWorkspaceStatus(id: string, status: WorkspaceStatus): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('eng_workspaces').update({ status }).eq('id', id);
  if (error) throw new Error(`updateWorkspaceStatus failed: ${error.message}`);
}

export async function insertSource(input: {
  workspaceId: string;
  filename: string;
  mime: string;
  storageUrl: string | null;
  typedRep: TypedRep;
  isLarge: boolean;
}): Promise<Source> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_sources')
    .insert({
      workspace_id: input.workspaceId,
      filename: input.filename,
      mime: input.mime,
      storage_url: input.storageUrl,
      typed_rep: input.typedRep,
      is_large: input.isLarge,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insertSource failed: ${error?.message}`);
  return rowToSource(data);
}

export async function listSources(workspaceId: string): Promise<Source[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_sources')
    .select()
    .eq('workspace_id', workspaceId);
  if (error) throw new Error(`listSources failed: ${error.message}`);
  return (data ?? []).map(rowToSource);
}

// ---------- row -> domain mappers ----------

type WorkspaceRow = {
  id: string; org_id: string; owner_id: string | null;
  workflow_id: string; rules_pack_id: string; rules_pack_version: string;
  status: WorkspaceStatus; created_at: string;
};

function rowToWorkspace(r: WorkspaceRow): Workspace {
  return {
    id: r.id, orgId: r.org_id, ownerId: r.owner_id,
    workflowId: r.workflow_id, rulesPackId: r.rules_pack_id, rulesPackVersion: r.rules_pack_version,
    status: r.status, createdAt: r.created_at,
  };
}

type SourceRow = {
  id: string; workspace_id: string; filename: string; mime: string;
  storage_url: string | null; typed_rep: TypedRep; is_large: boolean;
};

function rowToSource(r: SourceRow): Source {
  return {
    id: r.id, workspaceId: r.workspace_id, filename: r.filename, mime: r.mime,
    storageUrl: r.storage_url, typedRep: r.typed_rep, isLarge: r.is_large,
  };
}
