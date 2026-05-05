'use client';

import React, { useState } from 'react';
import { I } from '@/components/ui/icons';
import { Btn } from '@/components/ui/primitives';
import type { Document } from '@/hooks/useDocuments';

// summary_json items can be plain strings (overview/risks) or {term, definition, page} objects.
// Normalise everything to the shape SummaryItem expects.
type NormalizedItem = { text: string; page?: number; tag?: string; severity?: string }

function normalizeItems(items: unknown[]): NormalizedItem[] {
  return (items ?? []).map(item => {
    if (typeof item === 'string') return { text: item }
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      // key_terms shape: {term, definition, page?}
      if ('term' in obj) {
        return {
          text: `**${obj.term}**: ${obj.definition}`,
          page: obj.page as number | undefined,
        }
      }
      // already-shaped items from static data or extra sections
      return obj as NormalizedItem
    }
    return { text: String(item) }
  })
}

const SummaryItem = ({ item, accent, onPageRef }: { item: NormalizedItem; accent: string; onPageRef?: (page: number, el: HTMLElement) => void }) => {
  const sevColor = item.severity === "high" ? "#b54a3a" : item.severity === "medium" ? "#b58b4f" : item.severity === "low" ? "#5a8e6e" : null;
  return (
    <div className="relative pl-3.5 py-1.5 border-l border-[var(--border)]">
      <div
        className="absolute -left-1 top-3 w-1.25 h-1.25 rounded-full"
        style={{ backgroundColor: sevColor || accent }}
      />
      <div className="text-[12.5px] text-[var(--text)] leading-relaxed">
        {item.text}
      </div>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {item.tag && (
          <span className="text-[9px] font-semibold tracking-wider uppercase" style={{ color: accent }}>{item.tag}</span>
        )}
        {item.severity && (
          <span className="text-[9px] font-semibold tracking-wider uppercase" style={{ color: sevColor ?? accent }}>{item.severity} risk</span>
        )}
        {item.page && (
          <button
            onClick={(e) => onPageRef?.(item.page!, e.currentTarget)}
            className="text-[10px] text-[var(--text-muted)] inline-flex items-center gap-0.75 px-1.25 py-0.25 rounded bg-[var(--bg-sunken)] font-mono hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
          >
            p.{item.page}
          </button>
        )}
      </div>
    </div>
  );
};

export default function SummaryTab({ doc, setTab, onRefetch, onPageRef }: { doc: Document; setTab: (t: string) => void; onRefetch?: () => void; onPageRef?: (page: number, el: HTMLElement) => void }) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rewriteMode, setRewriteMode] = useState(false);
  const [editedItems, setEditedItems] = useState<Record<string, NormalizedItem[]>>({});
  const [saving, setSaving] = useState(false);

  const sections = doc.summary_json ? [
    { id: 'overview',   icon: 'Book',   title: 'Overview',          accent: '#c85a3b', items: normalizeItems((doc.summary_json.overview  as unknown[]) || []) },
    { id: 'key-terms',  icon: 'Target', title: 'Key Terms',         accent: '#6b7eb5', items: normalizeItems((doc.summary_json.key_terms as unknown[]) || []) },
    { id: 'risks',      icon: 'Bolt',   title: 'Risks & Red Flags', accent: '#b54a3a', items: normalizeItems((doc.summary_json.risks     as unknown[]) || []) },
  ] : [];

  const [open, setOpen] = useState<string[]>([]);
  React.useEffect(() => { setOpen(sections.map(s => s.id)); }, [doc.id, !!doc.summary_json]);
  const toggle = (id: string) => setOpen(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id]);
  const allOpen = open.length === sections.length && sections.length > 0;

  async function copySummary() {
    const text = sections.map(s =>
      `## ${s.title}\n\n` + s.items.map(i => `- ${i.text}${i.page ? ` (p.${i.page})` : ''}`).join('\n')
    ).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveRewrite() {
    setSaving(true)
    try {
      const newJson: Record<string, unknown> = { ...doc.summary_json }

      const overviewItems = editedItems['overview'] ?? sections.find(s => s.id === 'overview')?.items ?? []
      newJson.overview = overviewItems.map(i => i.page ? { text: i.text, page: i.page } : i.text)

      const ktItems = editedItems['key-terms'] ?? sections.find(s => s.id === 'key-terms')?.items ?? []
      newJson.key_terms = ktItems.map(i => {
        const m = i.text.match(/^\*\*(.+?)\*\*:\s*(.+)$/)
        return m ? { term: m[1], definition: m[2], page: i.page } : { term: i.text, definition: '', page: i.page }
      })

      const riskItems = editedItems['risks'] ?? sections.find(s => s.id === 'risks')?.items ?? []
      newJson.risks = riskItems.map(i => ({ text: i.text, page: i.page, tag: i.tag, severity: i.severity }))

      const res = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, summary_json: newJson }),
      })

      if (res.ok) {
        setRewriteMode(false)
        onRefetch?.()
      } else {
        const err = await res.json()
        console.error('Save failed:', err)
      }
    } finally {
      setSaving(false)
    }
  }

  async function generateSummary() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/documents/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        setGenError(err.error ?? 'Generation failed');
      } else {
        onRefetch?.();
      }
    } catch {
      setGenError('Network error — please try again');
    } finally {
      setGenerating(false);
    }
  }

  if (!doc.summary_json) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
        <div className="p-4 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="serif text-[22px] font-normal tracking-tight m-0 mb-1">Summary</h2>
          <div className="text-xs text-[var(--text-muted)] leading-relaxed">
            No summary generated yet for <span className="text-[var(--text-soft)]">{doc.name}</span>.
          </div>
        </div>
        <div className="p-4 flex flex-col items-start gap-3">
          <div className="p-3 bg-[var(--bg-sunken)] rounded-lg border border-[var(--border)] text-[11.5px] text-[var(--text-muted)] leading-relaxed w-full">
            This document was uploaded without an AI summary. Click below to generate one now.
          </div>
          {genError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[11.5px] text-red-600 leading-relaxed w-full">
              ⚠️ {genError}
            </div>
          )}
          <Btn
            variant="solid"
            size="lg"
            onClick={generateSummary}
            className="w-full justify-center"
            icon={generating ? null : <I.Sparkle size={14}/>}
          >
            {generating ? 'Generating summary…' : 'Generate AI Summary'}
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="p-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="serif text-[22px] font-normal tracking-tight m-0">Summary</h2>
          <div className="text-[10px] text-[var(--text-muted)] inline-flex items-center gap-1">
            <span className="w-1.25 h-1.25 rounded-full bg-[#5a8e6e]"/>
            AI generated
          </div>
        </div>
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          AI-generated overview of <span className="text-[var(--text-soft)]">{doc.name}</span>. Click any point to open its source.
        </div>
        {rewriteMode ? (
          <div className="flex gap-1.5 mt-2.5">
            <button
              onClick={() => setRewriteMode(false)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded border border-[var(--border)]"
            >
              Cancel
            </button>
            <button
              onClick={saveRewrite}
              disabled={saving}
              className="text-[11px] text-white bg-[var(--accent)] hover:opacity-90 transition-opacity px-2 py-1 rounded disabled:opacity-60 flex items-center gap-1"
            >
              {saving ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save summary'}
            </button>
          </div>
        ) : (
          <div className="flex gap-1.25 mt-2.5 flex-wrap">
            <button
              onClick={() => setOpen(allOpen ? [] : sections.map(s => s.id))}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
            <span className="text-[var(--border-strong)]">·</span>
            <button
              onClick={copySummary}
              className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-0.75 hover:text-[var(--text)] transition-colors"
            >
              {copied ? <><I.Check size={11}/> Copied</> : <><I.Copy size={11}/> Copy</>}
            </button>
            <span className="text-[var(--border-strong)]">·</span>
            <button
              onClick={() => {
                const init: Record<string, NormalizedItem[]> = {}
                sections.forEach(s => { init[s.id] = s.items })
                setEditedItems(init)
                setRewriteMode(true)
              }}
              className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-0.75 hover:text-[var(--text)] transition-colors"
            >
              <I.Refresh size={11}/> Rewrite
            </button>
          </div>
        )}
      </div>

      <div className="p-3">
        {sections.map((s) => {
          const Icon = I[s.icon as keyof typeof I] || I.Book;
          const isOpen = open.includes(s.id);
          return (
            <div key={s.id} className="mb-1.5">
              <button
                onClick={() => toggle(s.id)}
                className="flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: s.accent + "18", color: s.accent }}
                >
                  <Icon size={13}/>
                </div>
                <span className="flex-1 text-[13px] font-semibold">{s.title}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{s.items.length}</span>
                <I.ChevronDown
                  size={13}
                  className={`text-[var(--text-muted)] transition-transform duration-180 ${isOpen ? '' : '-rotate-90'}`}
                />
              </button>

              {isOpen && (
                <div className="pl-11 pr-2.5 pb-3 animate-slideUp">
                  {rewriteMode ? (
                    (editedItems[s.id] ?? s.items).map((item, j) => (
                      <div key={j} className="relative pl-3.5 py-1 border-l border-[var(--border)] mb-1">
                        <textarea
                          value={item.text}
                          rows={2}
                          onChange={(e) => {
                            const updated = [...(editedItems[s.id] ?? s.items)]
                            updated[j] = { ...updated[j], text: e.target.value }
                            setEditedItems(prev => ({ ...prev, [s.id]: updated }))
                          }}
                          className="w-full resize-none bg-[var(--bg-sunken)] border border-[var(--border)] rounded px-2 py-1 text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        {(item.page || item.tag || item.severity) && (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {item.tag && <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">{item.tag}</span>}
                            {item.severity && <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">{item.severity} risk</span>}
                            {item.page && <span className="text-[10px] text-[var(--text-muted)] font-mono">p.{item.page}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    s.items.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)] py-1">No data available.</p>
                    ) : (
                      s.items.map((item, j) => (
                        <SummaryItem key={j} item={item} accent={s.accent} onPageRef={onPageRef}/>
                      ))
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-3.5 p-3 bg-[var(--bg-sunken)] rounded-lg border border-[var(--border)] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center">
            <I.Sparkle size={13}/>
          </div>
          <div className="flex-1 text-[11px] text-[var(--text-soft)] leading-relaxed">
            Ask a follow-up question about this summary.
          </div>
          <Btn
            size="sm"
            variant="outline"
            icon={<I.Arrow size={11}/>}
            onClick={() => setTab("chat")}
          >
            Open chat
          </Btn>
        </div>
      </div>
    </div>
  );
}
