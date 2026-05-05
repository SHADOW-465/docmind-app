'use client'
import { useState, useEffect } from 'react'
import { DocListPanel } from './DocListPanel'
import { AIPanel } from './AIPanel'
import { BezierBeam } from './BezierBeam'
import dynamic from 'next/dynamic'
import { useDocuments } from '@/hooks/useDocuments'
import { FileIcon } from '@/components/ui/icons'

// Lazy load PdfViewer to avoid hydration/worker issues
const PdfViewer = dynamic(() => import('./PdfViewer'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center bg-[var(--bg-sunken)] text-sm text-[var(--text-muted)]">Loading viewer…</div>
})

interface WorkspaceProps {
  initialDocId: string | null
}

export function Workspace({ initialDocId }: WorkspaceProps) {
  const { documents, refetch } = useDocuments()
  const [activeId, setActiveId] = useState<string | null>(initialDocId)
  const [targetPage, setTargetPage] = useState<number | null>(null)
  const [beamFrom, setBeamFrom] = useState<{ x: number; y: number } | null>(null)
  const [beamTo, setBeamTo] = useState<{ x: number; y: number } | null>(null)

  // Sync when parent changes the initialDocId (e.g. sidebar click while already in workspace)
  useEffect(() => {
    if (initialDocId !== null) setActiveId(initialDocId)
  }, [initialDocId])

  const activeDoc = documents.find(d => d.id === activeId) || null

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <DocListPanel
          activeDocId={activeId}
          onSelect={setActiveId}
          onDelete={(id) => { if (id === activeId) setActiveId(null) }}
        />
      
      {/* Viewer Panel */}
      <div className="flex-[2] flex flex-col bg-[var(--bg-sunken)] min-w-0">
        {activeDoc ? (
          activeDoc.storage_path && activeDoc.file_type === 'pdf' ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {activeDoc.is_large && (
                <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-700 flex items-center gap-1.5 shrink-0">
                  <span>⚠</span>
                  <span>Large document — AI context covers the first 20 pages only and is available this session only.</span>
                </div>
              )}
              <div className="flex-1 overflow-y-auto relative flex flex-col">
                {/* @ts-ignore */}
                <PdfViewer
                  url={activeDoc.storage_path.startsWith('/') ? activeDoc.storage_path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${activeDoc.storage_path}`}
                  targetPage={targetPage ?? undefined}
                  onPageReady={(_page, el) => {
                    const r = el.getBoundingClientRect()
                    setBeamTo({ x: r.left + 24, y: r.top + 24 })
                    setTimeout(() => {
                      setBeamFrom(null)
                      setBeamTo(null)
                      setTargetPage(null)
                    }, 1400)
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto">
                <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">{activeDoc.name}</p>
                {activeDoc.full_text ? (
                  <pre className="text-sm text-[var(--text)] whitespace-pre-wrap font-serif leading-relaxed">
                    {activeDoc.full_text}
                  </pre>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No text content available for this document.</p>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <FileIcon size={32} className="mb-4 opacity-50" />
            <p className="text-sm">Select a document from the list to view it</p>
          </div>
        )}
      </div>

      {/* AI Panel */}
      <AIPanel
        doc={activeDoc}
        onRefetch={refetch}
        onPageRef={(page, sourceEl) => {
          const r = sourceEl.getBoundingClientRect()
          setBeamFrom({ x: r.left, y: r.top + r.height / 2 })
          setTargetPage(page)
        }}
      />

      {beamFrom && beamTo && (
        <BezierBeam
          from={beamFrom}
          to={beamTo}
          onDone={() => { setBeamFrom(null); setBeamTo(null) }}
        />
      )}
    </div>
  )
}
