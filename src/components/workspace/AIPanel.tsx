'use client'
import { useState } from 'react'
import { SparkleIcon } from '@/components/ui/icons'
import { Segmented } from '@/components/ui/primitives'
import type { Document } from '@/hooks/useDocuments'
import ChatTab from './ChatTab'
import GenerateTab from './GenerateTab'
import SummaryTab from './SummaryTab'

interface AIPanelProps {
  doc: Document | null
  onRefetch?: () => void
  onPageRef?: (page: number, el: HTMLElement) => void
}

type Tab = 'summary' | 'chat' | 'generate'

export function AIPanel({ doc, onRefetch, onPageRef }: AIPanelProps) {
  const [tab, setTab] = useState<Tab>('chat')

  if (!doc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg)] border-l border-[var(--border)]">
        <SparkleIcon size={24} className="text-[var(--border-strong)] mb-4" />
        <p className="text-sm text-[var(--text-soft)]">Select a document to use AI tools</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg)] border-l border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--border)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparkleIcon size={14} className="text-[var(--accent)]" />
          <span className="text-xs font-semibold text-[var(--text)]">DocMind AI</span>
        </div>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'summary', label: 'Summary' },
            { value: 'chat', label: 'Chat' },
            { value: 'generate', label: 'Generate' },
          ]}
        />
      </div>

      {/* key={doc.id} forces remount on document switch, clearing chat/generate state */}
      {tab === 'summary' ? (
        <SummaryTab key={doc.id} doc={doc} setTab={(t) => setTab(t as Tab)} onRefetch={onRefetch} onPageRef={onPageRef} />
      ) : tab === 'chat' ? (
        <ChatTab key={doc.id} doc={doc} />
      ) : (
        <GenerateTab key={doc.id} doc={doc} />
      )}
    </div>
  )
}
