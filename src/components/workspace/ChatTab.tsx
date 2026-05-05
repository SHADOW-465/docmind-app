'use client';

import React, { useState, useEffect, useRef } from 'react';
import { I } from '@/components/ui/icons';
import { Btn, Tooltip } from '@/components/ui/primitives';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { Document } from '@/hooks/useDocuments';

const formatMsg = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  );
};

const ChatMessage = ({ msg, doc }: { msg: any; doc: Document }) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-3.5 animate-fadeIn">
        <div className="max-w-[82%] px-3 py-2 bg-[var(--accent)] text-white rounded-[14px_14px_3px_14px] text-[12.5px] leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }
  const content = typeof msg.content === 'string' ? msg.content : (msg.content?.[0]?.text ?? '');
  return (
    <div className="flex gap-2.5 mb-4 animate-fadeIn">
      <div className="w-[26px] h-[26px] rounded-md shrink-0 bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center">
        <I.Sparkle size={13}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px] font-semibold">DocMind</span>
          <span className="text-[10px] text-[var(--text-muted)]">· grounded in {doc.name}</span>
        </div>
        <div className="text-[12.5px] leading-relaxed text-[var(--text)] whitespace-pre-wrap font-serif">
          {content.split("\n").map((line: string, i: number) => <div key={i}>{formatMsg(line)}{i < content.split("\n").length - 1 && <br/>}</div>)}
        </div>
        <div className="flex gap-0.5 mt-1.5">
          <button
            onClick={() => navigator.clipboard.writeText(content)}
            className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-all"
          >
            <I.Copy size={11}/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ChatTab({ doc }: { doc: Document }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { documentId: doc.id },
    }),
    onError: (err) => console.error('Chat error:', err),
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const submit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage({ text });
  };

  const sendSuggestion = (text: string) => {
    sendMessage({ text });
  };

  const suggestions = [
    "What are the key risks?",
    "Summarize the interest rate terms",
    "Explain the covenants",
    "What should I negotiate?",
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Context indicator */}
      <div className="p-2.5 px-4 flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--bg-sunken)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#5a8e6e] shadow-[0_0_0_3px_rgba(90,142,110,.18)]"/>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold leading-tight">Chatting with {doc.name}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{doc.page_count} pages · responses cite page numbers</div>
        </div>
        <Tooltip label="New chat">
          <button
            className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setMessages([])}
          >
            <I.Plus size={13}/>
          </button>
        </Tooltip>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="py-10 text-center animate-fadeIn">
            <div className="w-10.5 h-10.5 rounded-xl mx-auto mb-3.5 bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center">
              <I.Sparkle size={20}/>
            </div>
            <div className="serif text-xl font-normal mb-1 tracking-tight">Ask me anything</div>
            <div className="text-xs text-[var(--text-muted)] mb-4">
              I've read the entire document. What would you like to know?
            </div>
            <div className="flex flex-col gap-1.5 max-w-[280px] mx-auto">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => sendSuggestion(s)}
                  className="p-2.5 px-3 text-xs text-left bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m: any, i: number) => <ChatMessage key={i} msg={m} doc={doc}/>)}
        {error && (
          <div className="flex gap-2.5 mb-3.5">
            <div className="w-[26px] h-[26px] rounded-md shrink-0 bg-red-100 text-red-500 flex items-center justify-center text-[10px]">!</div>
            <div className="text-[11.5px] text-red-500 py-1.5 leading-relaxed">
              {error.message?.includes('Groq API key') || error.message?.includes('503')
                ? '⚠️ AI unavailable — please set a valid GROQ_API_KEY in .env.local and restart the server.'
                : `Error: ${error.message}`}
            </div>
          </div>
        )}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-2.5 mb-3.5">
            <div className="w-[26px] h-[26px] rounded-md shrink-0 bg-[var(--accent-soft)] text-[var(--accent-deep)] flex items-center justify-center">
              <I.Sparkle size={13}/>
            </div>
            <div className="flex gap-1 items-center py-2">
              {[0, 1, 2].map(j => (
                <span
                  key={j}
                  className="w-1.25 h-1.25 rounded-full bg-[var(--text-muted)] animate-pulse"
                  style={{ animationDelay: `${j * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-2.5 pb-3.5 px-3.5 border-t border-[var(--border)]">
        <div className="p-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-xl transition-colors focus-within:border-[var(--accent)]">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`Ask about ${doc.name}…`}
            rows={2}
            className="w-full resize-none border-0 outline-none bg-transparent font-sans text-[12.5px] leading-relaxed text-[var(--text)] p-1 px-1.5"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="flex gap-0.5">
              <Tooltip label="Attach"><Btn variant="ghost" size="sm" icon={<I.Paperclip size={13}/>}/></Tooltip>
              <Tooltip label="Voice"><Btn variant="ghost" size="sm" icon={<I.Mic size={13}/>}/></Tooltip>
            </div>
            <button
              onClick={submit}
              disabled={!input.trim() || isLoading}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                input.trim() && !isLoading ? 'bg-[var(--accent)] text-white cursor-pointer' : 'bg-[var(--border)] text-white cursor-default'
              }`}
            >
              <I.Arrow size={13}/>
            </button>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] text-center mt-1.5">
          DocMind can be inaccurate. Always verify important facts against the source.
        </div>
      </div>
    </div>
  );
}
