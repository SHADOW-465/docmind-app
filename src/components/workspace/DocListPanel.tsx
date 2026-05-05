'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useDocuments } from '@/hooks/useDocuments'
import { FileIcon, StarIcon, TrashIcon } from '@/components/ui/icons'
import { Chip } from '@/components/ui/primitives'
import type { Document } from '@/hooks/useDocuments'
import { MODES } from '@/lib/modes'
import type { Mode } from '@/lib/modes'
import { clsx } from 'clsx'

interface Workspace {
  id: string
  name: string
  mode: string
}

interface DocListPanelProps {
  activeDocId: string | null
  onSelect: (id: string) => void
  onDelete?: (id: string) => void
}

export function DocListPanel({ activeDocId, onSelect, onDelete }: DocListPanelProps) {
  const { documents, deleteDocument } = useDocuments()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWs, setSelectedWs] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('workspaces').select('*').order('created_at').then(({ data }) => {
      if (data) setWorkspaces(data as Workspace[])
    })
  }, [])

  const filtered = selectedWs
    ? documents.filter(d => {
        // Would need workspace_documents join — simplified: show all for MVP
        return true
      })
    : documents

  const THUMB_COLORS = ['#c85a3b', '#6b7eb5', '#5a8e6e', '#b58b4f', '#8a7a9e']

  return (
    <div className="flex flex-col h-full w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg-raised)] overflow-hidden">
      {/* Workspace selector */}
      <div className="px-3 py-2.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedWs(null)}
            className={clsx('text-[11px] px-2 py-1 rounded-full whitespace-nowrap transition-colors', !selectedWs ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
          >
            All
          </button>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => setSelectedWs(ws.id)}
              className={clsx('text-[11px] px-2 py-1 rounded-full whitespace-nowrap transition-colors', selectedWs === ws.id ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
            >
              {ws.name}
            </button>
          ))}
        </div>
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <FileIcon size={20} className="text-[var(--border-strong)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">No documents</p>
          </div>
        ) : (
          filtered.map((doc, i) => {
            const modeConfig = MODES[doc.mode as Mode]
            const isActive = doc.id === activeDocId
            return (
              <div
                key={doc.id}
                className={clsx(
                  'group w-full flex items-stretch border-b border-[var(--border)] transition-colors duration-100 relative',
                  isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)]" />}

                <button
                  onClick={() => onSelect(doc.id)}
                  className="flex-1 flex flex-col items-start px-4 py-3 text-left min-w-0"
                >
                  <div className="flex items-start justify-between w-full gap-2 mb-1">
                    <span className={clsx('text-xs font-medium line-clamp-2 leading-snug flex-1', isActive ? 'text-[var(--text)]' : 'text-[var(--text-soft)]')}>
                      {doc.name}
                    </span>
                    {doc.starred && <StarIcon size={10} className="text-[var(--accent)] shrink-0 mt-0.5" />}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap w-full">
                    {modeConfig && <span className="text-[9px] font-medium text-[var(--accent)] uppercase tracking-wider">{modeConfig.label}</span>}
                    <span className="text-[10px] text-[var(--text-muted)]">{Math.round(doc.file_size / 1024)} KB</span>
                  </div>
                </button>

                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    setDeletingId(doc.id)
                    try {
                      await deleteDocument(doc.id)
                      onDelete?.(doc.id)
                    } finally {
                      setDeletingId(null)
                    }
                  }}
                  disabled={deletingId === doc.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-8 shrink-0 mr-1 rounded-md hover:bg-red-50 hover:text-red-500 text-[var(--text-muted)] self-center"
                  title="Delete document"
                  aria-label="Delete document"
                >
                  {deletingId === doc.id ? (
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin block" />
                  ) : (
                    <TrashIcon size={12} />
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
