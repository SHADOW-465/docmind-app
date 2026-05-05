import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { summarizeDocument, suggestActions } from '@/lib/groq'
import { getDocument, updateDocument } from '@/lib/local-store'
import { getLargeDocText } from '@/lib/session-cache'
import type { Mode } from '@/lib/modes'

export const runtime = 'nodejs'
export const maxDuration = 60

function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey?.startsWith('gsk_') || apiKey.length < 20) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured.' }, { status: 503 })
  }

  const { documentId } = await req.json() as { documentId: string }
  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
  }

  let text: string | null = null
  let mode: Mode = 'business'
  let name = ''

  if (isSupabaseConfigured()) {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('documents')
      .select('full_text, mode, name')
      .eq('id', documentId)
      .single()
    if (error || !data) {
      // FALLBACK: check local-store
      const local = getDocument(documentId)
      if (!local) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      text = local.full_text
      mode = (local.mode as Mode) ?? 'business'
      name = local.name
    } else {
      text = data.full_text
      mode = (data.mode as Mode) ?? 'business'
      name = data.name
    }
  } else {
    const doc = getDocument(documentId)
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    text = doc.full_text
    mode = (doc.mode as Mode) ?? 'business'
    name = doc.name
  }

  if (!text || text.length < 50) {
    const cached = getLargeDocText(documentId)
    if (cached) text = cached
  }

  if (!text || text.length < 50) {
    return NextResponse.json({ error: 'Document has no extractable text' }, { status: 422 })
  }

  // Sequential to stay within Groq free-tier 12k TPM limit
  const summaryJson = await summarizeDocument(text, mode)
  const suggestedActions = summaryJson ? await suggestActions(text, name, mode) : []

  if (!summaryJson) {
    return NextResponse.json({ error: 'AI summarization failed. Check GROQ_API_KEY and try again.' }, { status: 500 })
  }

  if (isSupabaseConfigured()) {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('documents')
      .update({ summary_json: summaryJson, suggested_actions: suggestedActions.length > 0 ? suggestedActions : null })
      .eq('id', documentId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    const updated = updateDocument(documentId, {
      summary_json: summaryJson,
      suggested_actions: suggestedActions.length > 0 ? suggestedActions : null,
    })
    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json(updated)
  }
}
