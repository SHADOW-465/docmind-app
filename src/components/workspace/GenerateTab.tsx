'use client';

import React, { useState, useEffect } from 'react';
import { I } from '@/components/ui/icons';
import { Btn, Segmented, Card, Tooltip } from '@/components/ui/primitives';
import { useCompletion } from '@ai-sdk/react';
import type { Document } from '@/hooks/useDocuments';

const formatMarkdown = (text: string) => {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formattedLine = parts.map((p, idx) =>
      p.startsWith("**") ? <strong key={idx} className="font-semibold">{p.slice(2, -2)}</strong> : <React.Fragment key={idx}>{p}</React.Fragment>
    );

    if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-semibold mt-4 mb-2">{formattedLine.slice(1)}</h1>;
    if (line.startsWith('## ')) return <h2 key={i} className="text-md font-semibold mt-3 mb-1.5">{formattedLine.slice(1)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold mt-2 mb-1">{formattedLine.slice(1)}</h3>;
    if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-[12px] font-serif leading-relaxed text-[var(--text-soft)]">{formattedLine.slice(1)}</li>;
    if (line.trim() === '') return <br key={i}/>;
    return <div key={i} className="text-[12px] font-serif leading-relaxed text-[var(--text-soft)] whitespace-pre-wrap">{formattedLine}</div>;
  });
};

type GenOption = { id: string; label: string; description: string }

const DEFAULT_OPTIONS: GenOption[] = [
  { id: 'executive_summary', label: 'Executive Summary', description: 'A concise overview of the key points and main takeaways' },
  { id: 'key_points', label: 'Key Points', description: 'The most important facts and insights as a structured bullet list' },
  { id: 'discussion_questions', label: 'Discussion Questions', description: 'Thought-provoking questions to explore the content further' },
  { id: 'glossary', label: 'Glossary', description: 'Definitions of key terms and concepts used in the document' },
]

export default function GenerateTab({ doc }: { doc: Document }) {
  // Prefer AI-inferred suggested_actions (doc-specific); fall back to generic defaults
  const options: GenOption[] = (doc.suggested_actions && doc.suggested_actions.length > 0)
    ? doc.suggested_actions
    : DEFAULT_OPTIONS

  const [selected, setSelected] = useState<string | null>(null);
  const [tone, setTone] = useState("neutral");
  const [length, setLength] = useState("medium");

  const { completion, complete, isLoading, setCompletion, error } = useCompletion({
    api: '/api/generate',
    onError: (err) => console.error('Generate error:', err),
  });

  // Reset when doc changes (AIPanel keys this component, but guard here too)
  useEffect(() => { setSelected(null); setCompletion(''); }, [doc.id, setCompletion]);

  const run = () => {
    if (!selected) return;
    const opt = options.find(o => o.id === selected);
    if (!opt) return;
    complete('', {
      body: {
        documentId: doc.id,
        type: opt.id,
        label: opt.label,
        description: opt.description,
        length,
        tone,
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 pt-4 pb-3 border-b border-[var(--border)]">
        <h2 className="serif text-[22px] font-normal tracking-tight m-0 mb-1">Generate</h2>
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          Create new content grounded in <span className="text-[var(--text-soft)]">{doc.name}</span>.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 scrollbar-thin">
        {/* Options list */}
        <div className="flex flex-col gap-2 mb-4">
          {options.map(opt => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`p-3 text-left bg-[var(--bg-raised)] border-[1.5px] rounded-xl transition-all duration-150 flex flex-col gap-1 ${
                  active ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-[12.5px] font-semibold ${active ? 'text-[var(--accent)]' : ''}`}>{opt.label}</div>
                  {active && <I.Check size={13} className="text-[var(--accent)]" />}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">{opt.description}</div>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mb-3.5">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">Options</div>
          <div className="flex flex-col gap-2.5 p-3 bg-[var(--bg-sunken)] rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-[var(--text-muted)] w-12">Length</span>
              <Segmented value={length} onChange={setLength} options={[
                { value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "long", label: "Long" }
              ]}/>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-[var(--text-muted)] w-12">Tone</span>
              <Segmented value={tone} onChange={setTone} options={[
                { value: "formal", label: "Formal" }, { value: "neutral", label: "Neutral" }, { value: "casual", label: "Casual" }
              ]}/>
            </div>
          </div>
        </div>

        <Btn
          variant="solid"
          size="lg"
          onClick={run}
          className={`w-full justify-center ${!selected && 'opacity-55 pointer-events-none'}`}
          icon={isLoading ? null : <I.Sparkle size={14}/>}
        >
          {isLoading ? "Generating…" : selected ? `Generate ${options.find(o => o.id === selected)?.label.toLowerCase()}` : "Select a type to begin"}
        </Btn>

        {/* Error state */}
        {error && (
          <div className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-[11.5px] text-red-600 leading-relaxed">
            ⚠️ {error.message?.includes('503') || error.message?.includes('not configured')
              ? 'AI unavailable — please add a valid GROQ_API_KEY to .env.local and restart the dev server.'
              : `Generation failed: ${error.message}`}
          </div>
        )}
        {isLoading && !completion && (
          <div className="mt-3.5 p-3.5 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2">
            {[100, 85, 95, 70, 90, 60].map((w, i) => (
              <div
                key={i}
                className={`h-${i === 0 ? '3.5' : '2.5'} bg-stone-200 rounded-md animate-shimmer bg-[linear-gradient(90deg,var(--bg-hover)_0%,var(--border)_50%,var(--bg-hover)_100%)] bg-[length:200%_100%]`}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}

        {completion && (
          <div className="mt-3.5 animate-slideUp">
            <Card className="p-4">
              <div className="flex items-start justify-between mb-3 pb-2.5 border-b border-[var(--border)]">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug mb-0.75 truncate">
                    {options.find(o => o.id === selected)?.label} — {doc.name}
                  </div>
                  <div className="text-[10.5px] text-[var(--text-muted)]">Generated · {length} · {tone}</div>
                </div>
                <div className="flex gap-0.75 shrink-0 ml-2">
                  <Tooltip label="Copy"><Btn variant="ghost" size="sm" icon={<I.Copy size={12}/>}/></Tooltip>
                  <Tooltip label="Download"><Btn variant="ghost" size="sm" icon={<I.Download size={12}/>}/></Tooltip>
                  <Tooltip label="Regenerate"><Btn variant="ghost" size="sm" icon={<I.Refresh size={12}/>}/></Tooltip>
                </div>
              </div>
              <div className="space-y-1">
                {formatMarkdown(completion)}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
