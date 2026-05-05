import { streamText } from 'ai'
import { groq, MODEL, MAX_CONTEXT_CHARS } from '@/lib/groq'
import { getPersona, type Mode } from '@/lib/modes'
import { createServerClient } from '@/lib/supabase-server'
import { getDocument } from '@/lib/local-store'
import { getLargeDocText } from '@/lib/session-cache'

function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey?.startsWith('gsk_') || apiKey.length < 20) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { documentId, type, label, description, length = 'medium', tone = 'formal' } =
    await req.json() as {
      documentId: string
      type: string
      label: string
      description: string
      length?: 'short' | 'medium' | 'long'
      tone?: 'formal' | 'neutral' | 'casual'
    }

  let doc: { name: string; full_text: string | null; mode: string } | null = null

  if (isSupabaseConfigured()) {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('documents')
      .select('name, full_text, mode')
      .eq('id', documentId)
      .single()
    if (!data) {
      // FALLBACK: check local-store
      const local = getDocument(documentId)
      if (local) doc = { name: local.name, full_text: local.full_text, mode: local.mode }
    } else {
      doc = data
    }
  } else {
    const local = getDocument(documentId)
    if (local) doc = { name: local.name, full_text: local.full_text, mode: local.mode }
  }

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const mode = (doc.mode as Mode) ?? 'business'
  const fullText = doc.full_text ?? getLargeDocText(documentId) ?? ''
  const context = fullText.slice(0, MAX_CONTEXT_CHARS)

  const lengthGuide = { short: '200-300 words', medium: '400-600 words', long: '800-1200 words' }[length]
  const toneGuide = { formal: 'formal and professional', neutral: 'clear and neutral', casual: 'conversational and accessible' }[tone]

  const systemPrompt = `${getPersona(mode)}

Generate the following from the document "${doc.name}": ${label}
${description}

Requirements:
- Length: ${lengthGuide}
- Tone: ${toneGuide}
- Format: Use Markdown (headings, bullet points, bold for key terms)
- Base your response entirely on the document content below

Document content:
${context}`

  const result = streamText({
    model: groq(MODEL),
    system: systemPrompt,
    prompt: `Generate: ${label}`,
    // @ts-ignore
    maxTokens: 2000,
    onFinish: async ({ text }) => {
      if (!isSupabaseConfigured()) return
      const supabase = createServerClient()
      await supabase.from('generated_outputs').insert({
        document_id: documentId,
        type,
        content: text,
        length,
        tone,
      })
    },
  })

  return result.toTextStreamResponse()
}
