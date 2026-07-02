import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DOCS_FILE = path.join(
  process.env.VERCEL || process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT ? '/tmp' : process.cwd(),
  '.local-documents.json'
)

export interface LocalDocument {
  id: string
  name: string
  mode: string
  file_type: string
  storage_path: string | null
  full_text: string | null
  page_count: number
  file_size: number
  is_large: boolean
  summary_json: Record<string, unknown> | null
  suggested_actions: Array<{ id: string; label: string; description: string }> | null
  starred: boolean
  created_at: string
}

function readDocs(): LocalDocument[] {
  try {
    if (fs.existsSync(DOCS_FILE)) {
      return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf-8')) as LocalDocument[]
    }
  } catch {}
  return []
}

function writeDocs(docs: LocalDocument[]) {
  fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2), 'utf-8')
}

export function listDocuments(): LocalDocument[] {
  return readDocs().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function getDocument(id: string): LocalDocument | null {
  return readDocs().find(d => d.id === id) ?? null
}

export function insertDocument(
  data: Omit<LocalDocument, 'id' | 'starred' | 'created_at'>
): LocalDocument {
  const docs = readDocs()
  const doc: LocalDocument = {
    id: randomUUID(),
    starred: false,
    created_at: new Date().toISOString(),
    ...data,
  }
  docs.push(doc)
  writeDocs(docs)
  return doc
}

export function updateDocument(id: string, patch: Partial<LocalDocument>): LocalDocument | null {
  const docs = readDocs()
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return null
  docs[idx] = { ...docs[idx], ...patch }
  writeDocs(docs)
  return docs[idx]
}

export function removeDocument(id: string): boolean {
  const docs = readDocs()
  const next = docs.filter(d => d.id !== id)
  if (next.length === docs.length) return false
  writeDocs(next)
  return true
}
