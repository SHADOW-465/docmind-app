'use client';

import React, { useState } from 'react';
import { I } from '@/components/ui/icons';
import { Btn } from '@/components/ui/primitives';
import { SUMMARY_SECTIONS } from '@/lib/data';
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

const SummaryItem = ({ item, accent }: { item: NormalizedItem; accent: string }) => {
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
          <button className="text-[10px] text-[var(--text-muted)] inline-flex items-center gap-0.75 px-1.25 py-0.25 rounded bg-[var(--bg-sunken)] font-mono hover:text-[var(--accent)] transition-colors">
            p.{item.page}
          </button>
        )}
      </div>
    </div>
  );
};

export default function SummaryTab({ doc, setTab }: { doc: Document; setTab: (t: string) => void }) {
  const sections = doc.summary_json ? [
    { id: 'overview',   icon: 'Book',   title: 'Overview',          accent: '#c85a3b', items: normalizeItems((doc.summary_json.overview  as unknown[]) || []) },
    { id: 'key-terms',  icon: 'Target', title: 'Key Terms',         accent: '#6b7eb5', items: normalizeItems((doc.summary_json.key_terms as unknown[]) || []) },
    { id: 'risks',      icon: 'Bolt',   title: 'Risks & Red Flags', accent: '#b54a3a', items: normalizeItems((doc.summary_json.risks     as unknown[]) || []) },
  ] : SUMMARY_SECTIONS.map(s => ({ ...s, items: s.items as NormalizedItem[] }));

  const [open, setOpen] = useState(() => sections.map(s => s.id));
  const toggle = (id: string) => setOpen(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id]);
  const allOpen = open.length === sections.length;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="p-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="serif text-[22px] font-normal tracking-tight m-0">Summary</h2>
          <div className="text-[10px] text-[var(--text-muted)] inline-flex items-center gap-1">
            <span className="w-1.25 h-1.25 rounded-full bg-[#5a8e6e]"/>
            {doc.summary_json ? 'AI generated' : 'Sample data'}
          </div>
        </div>
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          AI-generated overview of <span className="text-[var(--text-soft)]">{doc.name}</span>. Click any point to open its source.
        </div>
        <div className="flex gap-1.25 mt-2.5 flex-wrap">
          <button
            onClick={() => setOpen(allOpen ? [] : sections.map(s => s.id))}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
          <span className="text-[var(--border-strong)]">·</span>
          <button className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-0.75 hover:text-[var(--text)] transition-colors">
            <I.Copy size={11}/> Copy
          </button>
        </div>
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
                  {s.items.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)] py-1">No data available.</p>
                  ) : (
                    s.items.map((item, j) => (
                      <SummaryItem key={j} item={item} accent={s.accent}/>
                    ))
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
