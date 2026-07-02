# Running the DocMind Supabase migrations

You said you've attached a new Supabase database and will run migrations later — this is the guide for that.

## What's in this folder

| File | What it creates | Needed for |
|---|---|---|
| `001_initial_schema.sql` | `app_state`, `documents`, `workspaces`, `workspace_documents`, `chat_messages`, `generated_outputs` | The legacy chat-with-your-PDF app (mode-first UI, still in the repo and functional) |
| `002_engine_schema.sql` | `organizations`, `memberships`, `rules_packs`, `eng_workspaces`, `eng_sources`, `eng_canonical_entities`, `eng_workflow_runs`, `eng_artifacts`, `eng_trace_events` (partitioned 8-way) | The new engine layer (GPSR/EPR vertical, and any future vertical) |

Both are additive — 002 doesn't touch or drop anything from 001. Run them **in order**, 001 then 002; 002 has no hard SQL dependency on 001 but is written assuming it runs second.

## How to run them

**Option A — Supabase SQL Editor (simplest, no CLI needed)**
1. Open your project at supabase.com → SQL Editor.
2. Paste the contents of `001_initial_schema.sql`, run it.
3. Paste the contents of `002_engine_schema.sql`, run it.

**Option B — Supabase CLI**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```
This applies every migration in this folder in filename order.

Both migrations use `create table if not exists`, so re-running them is safe (idempotent) if you're not sure whether they already applied.

## Environment variables to set after migrating

Wherever the app runs (local `.env`, and your Vercel project's env vars — this is also what causes the `EROFS` error you saw if it's missing on Vercel), set:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase project settings>
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase project settings>
```

Without these, `isSupabaseConfigured()` (see `src/app/api/app-state/route.ts` and `src/lib/data-layer` more broadly) returns false and the app silently falls back to local-disk/session-cache storage — which works in local dev but fails on Vercel's read-only filesystem.

For the engine's gated integration tests (`engine/__tests__/integration/`) and for live AI calls through the workflow, also set:

```
AI_GATEWAY_API_KEY=<Vercel AI Gateway key>
```

## Verifying it worked

After running both migrations, in the SQL Editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```
You should see all the tables listed in the table above, plus 8 partitions named `eng_trace_events_p0` … `eng_trace_events_p7`.

Then locally: `npm run test:run` — the 2 currently-skipped integration tests in `engine/__tests__/integration/` should start running (not skipping) once `AI_GATEWAY_API_KEY` + the two Supabase vars above are present in your environment, and should pass against the new database.
