-- Engine schema (Phase 1). Legacy tables from 001 remain in place; a later
-- migration will retire them once the legacy UI is removed.

-- ---------- Multi-tenant scaffolding ----------

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- Seed a default org so single-tenant local dev works without auth UI.
insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Org')
on conflict (id) do nothing;

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null,
  role        text not null default 'member' check (role in ('owner','admin','member','reviewer')),
  created_at  timestamptz default now(),
  unique (org_id, user_id)
);

-- ---------- Rules packs (registry of installed packs) ----------

create table if not exists rules_packs (
  id              text not null,
  version         text not null,
  manifest        jsonb not null,
  storage_prefix  text not null,
  installed_at    timestamptz default now(),
  primary key (id, version)
);

-- ---------- Workspaces ----------

create table if not exists eng_workspaces (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  owner_id              uuid,
  workflow_id           text not null,
  rules_pack_id         text not null,
  rules_pack_version    text not null,
  status                text not null default 'open'
                          check (status in ('open','awaiting_review','emitted','archived')),
  created_at            timestamptz default now()
);
create index if not exists eng_workspaces_org_idx on eng_workspaces(org_id);

-- ---------- Sources (uploaded docs per workspace) ----------

create table if not exists eng_sources (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references eng_workspaces(id) on delete cascade,
  filename      text not null,
  mime          text not null,
  storage_url   text,
  typed_rep     jsonb not null,
  is_large      boolean not null default false,
  created_at    timestamptz default now()
);
create index if not exists eng_sources_workspace_idx on eng_sources(workspace_id);

-- ---------- Canonical entities ----------

create table if not exists eng_canonical_entities (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references eng_workspaces(id) on delete cascade,
  type              text not null,
  value             jsonb not null,
  citations         jsonb not null default '[]',
  created_at        timestamptz default now()
);
create index if not exists eng_entities_workspace_idx on eng_canonical_entities(workspace_id);

-- ---------- Workflow runs ----------

create table if not exists eng_workflow_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references eng_workspaces(id) on delete cascade,
  graph_id        text not null,
  current_node    text,
  state           jsonb not null default '{}',
  updated_at      timestamptz default now()
);
create index if not exists eng_runs_workspace_idx on eng_workflow_runs(workspace_id);

-- ---------- Artifacts ----------

create table if not exists eng_artifacts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references eng_workspaces(id) on delete cascade,
  type              text not null,
  schema_id         text not null,
  value             jsonb not null,
  status            text not null default 'draft'
                      check (status in ('draft','awaiting_review','approved','emitted')),
  emitted_format    text,
  emitted_url       text,
  created_at        timestamptz default now()
);
create index if not exists eng_artifacts_workspace_idx on eng_artifacts(workspace_id);

-- ---------- Trace events (append-only) ----------
-- Declarative partitioning by workspace_id hash; 8 partitions is enough for now.

create table if not exists eng_trace_events (
  id                uuid not null default gen_random_uuid(),
  workspace_id      uuid not null,
  workflow_run_id   uuid,
  node_id           text,
  primitive         text not null,
  inputs            jsonb not null default '{}',
  output            jsonb not null default '{}',
  model             jsonb,
  confidence        numeric,
  latency_ms        integer not null default 0,
  cost_usd          numeric,
  reviewer          jsonb,
  created_at        timestamptz not null default now(),
  primary key (id, workspace_id)
) partition by hash (workspace_id);

do $$
begin
  for i in 0..7 loop
    execute format(
      'create table if not exists eng_trace_events_p%1$s partition of eng_trace_events for values with (modulus 8, remainder %1$s)',
      i
    );
  end loop;
end$$;

create index if not exists eng_trace_workspace_idx on eng_trace_events(workspace_id, created_at desc);
