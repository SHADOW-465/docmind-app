import { streamText, convertToModelMessages } from 'ai'
import type { UIMessage } from 'ai'
import { groq, MODEL, MAX_CONTEXT_CHARS } from '@/lib/groq'
import { getPersona, type Mode } from '@/lib/modes'
import { retrieveRelevant } from '@/lib/rag'
import { createServerClient } from '@/lib/supabase-server'
import { getDocument } from '@/lib/local-store'
import { getLargeDocText } from '@/lib/session-cache'

export const runtime = 'nodejs'
export const maxDuration = 60

function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey?.startsWith('gsk_') || apiKey.length < 20) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY is not configured. Add it to .env.local.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages, documentId } = await req.json() as { messages: UIMessage[]; documentId: string }

  // Fetch document — try Supabase, fall back to local store
  let doc: { name: string; full_text: string | null; is_large: boolean; mode: string } | null = null

  if (isSupabaseConfigured()) {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('documents')
      .select('name, full_text, is_large, mode')
      .eq('id', documentId)
      .single()
    if (!data) {
      // FALLBACK: check local-store
      const local = getDocument(documentId)
      if (local) {
        doc = { name: local.name, full_text: local.full_text, is_large: local.is_large, mode: local.mode }
      }
    } else {
      doc = data
    }
  } else {
    const local = getDocument(documentId)
    if (local) {
      doc = { name: local.name, full_text: local.full_text, is_large: local.is_large, mode: local.mode }
    }
  }

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build context
  let context: string
  if (doc.is_large) {
    const lastMsg: any = messages[messages.length - 1]
    const lastText = typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : lastMsg?.parts?.find((p: { type: string }) => p.type === 'text')?.text ?? ''
    const cached = getLargeDocText(documentId)
    context = cached ? cached.slice(0, MAX_CONTEXT_CHARS) : await retrieveRelevant(lastText, documentId)
  } else {
    context = (doc.full_text ?? '').slice(0, MAX_CONTEXT_CHARS)
  }

  const mode = (doc.mode as Mode) ?? 'business'
  const persona = getPersona(mode)

  const systemPrompt = `${persona}

You are answering questions about the document: "${doc.name}".
Answer based only on the document content provided. If the answer is not in the document, say so clearly.
When citing information, reference the relevant section or concept from the document.

Document content:
${context}`

  const modelMessages = await convertToModelMessages(messages)

  const lastUserText = (() => {
    const last: any = messages[messages.length - 1]
    if (!last || last.role !== 'user') return ''
    if (typeof last.content === 'string') return last.content
    return last.parts?.find((p: { type: string; text?: string }) => p.type === 'text')?.text ?? ''
  })()

  const result = streamText({
    model: groq(MODEL),
    system: systemPrompt,
    messages: modelMessages,
    // @ts-ignore
    maxTokens: 1200,
    onFinish: async ({ text }) => {
      if (!lastUserText || !isSupabaseConfigured()) return
      const supabase = createServerClient()
      await supabase.from('chat_messages').insert([
        { document_id: documentId, role: 'user', content: lastUserText },
        { document_id: documentId, role: 'assistant', content: text },
      ])
    },
  })

  return result.toUIMessageStreamResponse()
}
