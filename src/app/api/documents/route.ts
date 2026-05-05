import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { listDocuments, updateDocument, removeDocument } from '@/lib/local-store'
import { deleteLargeDocText } from '@/lib/session-cache'

function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(listDocuments())
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: Request) {
  const { id, ...patch } = await req.json() as { id: string; [k: string]: unknown }

  if (!isSupabaseConfigured()) {
    const updated = updateDocument(id, patch as Parameters<typeof updateDocument>[1])
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('documents')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { id } = await req.json() as { id: string }

  if (!isSupabaseConfigured()) {
    removeDocument(id)
    deleteLargeDocText(id)
    return NextResponse.json({ success: true })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  deleteLargeDocText(id)
  return NextResponse.json({ success: true })
}
