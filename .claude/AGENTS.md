# DocMind — Agent Quick Reference

> **Next.js 16 App Router** — APIs, conventions, and file structure differ from training data.
> Read `node_modules/next/dist/docs/` before writing any route or component code.

## Stack
- Next.js 16.2.4 (App Router, Turbopack), React 19, TypeScript
- AI SDK v6 (`ai@6`, `@ai-sdk/react@3`), Groq `llama-3.3-70b-versatile`
- Supabase (PostgreSQL + Storage), SWR, Tailwind CSS 4, framer-motion v12
- **Engine layer** (`engine/`, Phases 1–2): framework-agnostic document-creation engine (primitives + workflows + rules packs). Deps: `ajv`, `ajv-formats`, `yaml`, `@ai-sdk/gateway`, `zod`. AI calls route through **Vercel AI Gateway** (`engine/providers/gateway.ts`) via `model("provider/model")` strings (e.g. `groq/llama-3.3-70b-versatile`, `anthropic/claude-sonnet-4-5`).

## Hard Rules
- Icons: always `I.*` from `src/components/ui/icons.tsx` — **never** import lucide-react directly
- API routes: always `export const runtime = 'nodejs'` and `export const maxDuration = 60`
- Groq calls: **sequential only** (no `Promise.all`) — free-tier 12,000 TPM limit
- Document fetching: always use **dual-source pattern** (Supabase → local-store fallback → 404)
- Large docs (`is_large=true`): `full_text=null` in DB; text lives in session cache only
- Engine code lives in `engine/` (import via alias `@engine/*`) and is **framework-agnostic** — no Next.js / React imports
- New vertical = a new rules pack under `rules-packs/<id>/<version>/` + a workflow file in `engine/workflows/` — **no engine code change**
- AI SDK v6 uses `maxOutputTokens` (NOT `maxTokens`)

## Reference Files (read before working on that area)

| Area | File |
|------|------|
| Architecture & app flow | [`.claude/references/architecture.md`](./references/architecture.md) |
| Engine layer (primitives, workflows, rules packs) | [`.claude/references/engine.md`](./references/engine.md) |
| Frontend components | [`.claude/references/frontend-components.md`](./references/frontend-components.md) |
| API routes | [`.claude/references/api-routes.md`](./references/api-routes.md) |
| Database & data layer | [`.claude/references/data-layer.md`](./references/data-layer.md) |
| AI / Groq integration | [`.claude/references/ai-integration.md`](./references/ai-integration.md) |
| Design system & styling | [`.claude/references/design-system.md`](./references/design-system.md) |
| Errors & solutions log | [`.claude/references/errors-and-solutions.md`](./references/errors-and-solutions.md) |
