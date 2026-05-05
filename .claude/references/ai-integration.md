# DocMind — AI Integration Reference

## Provider & Model

- **Provider:** Groq via `@ai-sdk/groq`
- **Model:** `llama-3.3-70b-versatile`
- **SDK:** AI SDK v6 (`ai@6.0.168`, `@ai-sdk/react@3.0.170`)
- **Groq wrapper:** `src/lib/groq.ts`

## Free-Tier Constraints

| Limit | Value | Impact |
|-------|-------|--------|
| TPM (tokens per minute) | 12,000 | Determines how much text we can send |
| `MAX_SUMMARY_CHARS` | 28,000 chars ≈ 7k tokens | Safe under 12k TPM |
| `MAX_CONTEXT_CHARS` | 96,000 chars | For chat (paid plans may tolerate more) |
| Max output tokens (summary) | 2,000 | Increased from 1,500 to prevent JSON truncation |

**Sequential calls are mandatory.** Never use `Promise.all([summarizeDocument(), suggestActions()])` — this sends both prompts simultaneously and exceeds the TPM limit. Always `await` one before starting the other.

## Groq API Key Validation

```ts
const groqKeyValid = process.env.GROQ_API_KEY?.startsWith('gsk_') &&
  (process.env.GROQ_API_KEY?.length ?? 0) > 20
```

If invalid: AI features are silently skipped on upload. Documents are stored without `summary_json` or `suggested_actions`. The user can trigger re-summarization from the SummaryTab.

## src/lib/groq.ts Functions

### summarizeDocument(text, mode)
Generates structured `summary_json` for a document.

- Input: raw extracted text (truncated to `MAX_SUMMARY_CHARS`)
- Prompt: built by `buildSummaryPrompt(text, mode)` from `src/lib/modes.ts`
- Output: parsed JSON object (shape varies by mode — see data-layer.md)
- Max output tokens: 2,000
- Returns `null` on any error (non-fatal)

### suggestActions(text, filename, mode)
Generates the `suggested_actions` array for the GenerateTab.

- Input: text + filename + mode
- Output: `Array<{ id, label, description }>`
- Returns `[]` on error (non-fatal)

## AI SDK v6 — Critical API Differences from v5

The AI SDK went through a major breaking change between v5 and v6. Training data is often wrong about v6 APIs.

### useChat (client-side streaming chat)
```ts
// CORRECT — how ChatTab.tsx is implemented
import { useChat } from '@ai-sdk/react'
const { messages, sendMessage, status, setMessages, error } = useChat({
  api: '/api/chat',
  body: { documentId: doc.id },
  onError: (err) => console.error(err),
})
// status is 'streaming' | 'submitted' | 'ready' | 'error'
const isLoading = status === 'streaming' || status === 'submitted'
sendMessage({ text: 'Hello' })  // sends a user message

// WRONG — AI SDK v4/v5 pattern (throws "sendMessage is not a function")
const { append } = useChat(...)
append({ role: 'user', content: 'Hello' })
```

### useCompletion (client-side text completion)
```ts
// CORRECT — how GenerateTab.tsx is implemented
import { useCompletion } from '@ai-sdk/react'
const { completion, complete, isLoading, setCompletion, error } = useCompletion({
  api: '/api/generate',
  onError: (err) => console.error(err),
})
// isLoading is a boolean — use this, not status

// WRONG — status field does not exist on useCompletion
const { status } = useCompletion(...)
```

### Server-side streaming (chat route)
```ts
import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const result = streamText({
  model: groq('llama-3.3-70b-versatile'),
  system: systemPrompt,
  messages,
})
return result.toDataStreamResponse()  // for useChat
```

### Server-side streaming (generate route)
```ts
const result = streamText({ model, system, prompt })
return result.toTextStreamResponse()  // for useCompletion (plain text stream, not data stream)
```

**Do not confuse the two response types:**
- `toDataStreamResponse()` — structured stream format, consumed by `useChat`
- `toTextStreamResponse()` — raw text stream, consumed by `useCompletion`

## Document Mode System (src/lib/modes.ts)

Each mode provides a specialized AI experience:

```ts
interface ModeConfig {
  label: string
  icon: string
  description: string
  persona: string           // injected into system prompt
  summaryStructure: SectionSpec[]  // drives buildSummaryPrompt()
  chatStarters: string[]    // suggested first questions for ChatTab
}

const MODES: Record<Mode, ModeConfig> = {
  scholar: { ... },
  legal: { ... },
  finance: { ... },
  medical: { ... },
  business: { ... },
}
```

### buildSummaryPrompt(text, mode)
Constructs the Groq prompt asking for structured JSON output. The prompt lists all required sections and their expected formats based on `MODES[mode].summaryStructure`. The model must return valid JSON — this is why `maxTokens: 2000` is important (truncated output = broken JSON).

### buildActionsPrompt(text, filename, mode)
Constructs the prompt asking for 3–5 custom generate options relevant to the document. Returns a JSON array of `{ id, label, description }` objects.

## RAG (src/lib/rag.ts)

**Status: NOT IMPLEMENTED**

`retrieveRelevant(text, query)` returns a placeholder string. It is called in the chat route when a large document's session cache entry is missing (i.e., after a cold start). In practice, the session cache check comes first, so this stub is rarely hit during normal use.

Future implementation would:
1. Chunk document text into segments
2. Embed each chunk (e.g., via Groq/OpenAI embeddings)
3. Store in Supabase pgvector
4. On query, embed the question and find nearest chunks
5. Return top-K chunks as context

## Chat Context Assembly

**Small docs:**
```ts
context = doc.full_text.slice(0, MAX_CONTEXT_CHARS)
```

**Large docs:**
```ts
const cached = getLargeDocText(documentId)
context = cached
  ? cached.slice(0, MAX_CONTEXT_CHARS)
  : await retrieveRelevant(...)  // RAG stub — returns placeholder
```

System prompt structure:
```
You are a {mode.persona}. Analyze the following document and answer questions accurately.

Document: {doc.name}
---
{context}
---

Answer based only on the document content. Be precise and cite page numbers when relevant.
```

## Error Handling in AI Routes

AI errors are non-fatal where possible:
- Upload: if Groq fails, doc is stored without summary (user can regenerate later)
- Chat/Generate: streaming errors are surfaced to the client via the AI SDK error state
- Summarize: returns 500 with error message if Groq fails

Client-side error display in GenerateTab:
```tsx
{error && (
  <div className="... text-red-600">
    ⚠️ {error.message?.includes('503') || error.message?.includes('not configured')
      ? 'AI unavailable — please add a valid GROQ_API_KEY to .env.local and restart the dev server.'
      : `Generation failed: ${error.message}`}
  </div>
)}
```
