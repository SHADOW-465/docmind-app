import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { extractFromBuffer } from '@/lib/extractor'
import { summarizeDocument, suggestActions } from '@/lib/groq'
import { insertDocument } from '@/lib/local-store'
import { setLargeDocText } from '@/lib/session-cache'
import type { Mode } from '@/lib/modes'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const mode = (formData.get('mode') as Mode | null) ?? 'business'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const MAX_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 413 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 1. Extract text
  const extraction = await extractFromBuffer(buffer, file.name)

  // 2. Generate summary and suggested actions (non-fatal)
  const groqKeyValid = process.env.GROQ_API_KEY?.startsWith('gsk_') &&
    (process.env.GROQ_API_KEY?.length ?? 0) > 20

  let summaryJson = null
  let suggestedActions: Array<{ id: string; label: string; description: string }> = []

  if (groqKeyValid && extraction.text.length > 50) {
    // Sequential to stay within Groq free-tier 12k TPM limit
    summaryJson = await summarizeDocument(extraction.text, mode)
    suggestedActions = await suggestActions(extraction.text, file.name, mode)
  }

  const docData = {
    name: file.name,
    mode,
    file_type: extraction.fileType,
    storage_path: null as string | null,
    full_text: extraction.isLarge ? null : extraction.text,
    page_count: extraction.pageCount,
    file_size: file.size,
    is_large: extraction.isLarge,
    summary_json: summaryJson,
    suggested_actions: suggestedActions.length > 0 ? suggestedActions : null,
  }

  if (!isSupabaseConfigured()) {
    // Save file to public/uploads so it can be served statically
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    fs.writeFileSync(path.join(uploadsDir, filename), buffer)
    docData.storage_path = `/uploads/${filename}`
    const doc = insertDocument(docData)
    if (extraction.isLarge) {
      setLargeDocText(doc.id, extraction.text)
    }
    return NextResponse.json(doc)
  }

  const supabase = createServerClient()

  // 3. Upload file to Supabase Storage
  const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, { contentType: file.type })

  docData.storage_path = storageError ? null : storagePath

  // 4. Insert document row
  const { data: doc, error: dbError } = await supabase
    .from('documents')
    .insert(docData)
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  if (extraction.isLarge) {
    setLargeDocText(doc.id, extraction.text)
  }
  return NextResponse.json(doc)
}
