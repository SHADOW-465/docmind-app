import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import fs from 'fs'
import path from 'path'

const LOCAL_STATE_FILE = path.join(process.cwd(), '.local-app-state.json')

const DEFAULT_STATE = {
  id: 1,
  active_mode: null as string | null,
  onboarding_done: false,
  theme: 'light',
  sidebar_collapsed: false,
}

function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}

function readLocalState() {
  try {
    if (fs.existsSync(LOCAL_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf-8'))
    }
  } catch {}
  return { ...DEFAULT_STATE }
}

function writeLocalState(state: typeof DEFAULT_STATE) {
  try {
    fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    // Read-only filesystem (e.g. deployed to Vercel without Supabase env vars
    // configured). Degrade to in-memory state for this request instead of 500ing.
    console.warn('app-state: local state file is not writable, falling back to in-memory state', err)
  }
  return state
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(readLocalState())
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('app_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? DEFAULT_STATE)
}

export async function PATCH(req: Request) {
  const body = await req.json() as Record<string, unknown>

  const allowed = ['active_mode', 'onboarding_done', 'theme', 'sidebar_collapsed']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    const current = readLocalState()
    const updated = { ...current, ...updates }
    writeLocalState(updated)
    return NextResponse.json(updated)
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('app_state')
    .upsert({ id: 1, ...updates })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
