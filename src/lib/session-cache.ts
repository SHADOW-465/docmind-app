// In-memory cache for large document text.
// Lives for the lifetime of the Node.js process (cleared on server restart or Vercel cold start).
// This is intentional: large doc AI features are session-scoped.

const cache = new Map<string, string>()

export function setLargeDocText(docId: string, text: string): void {
  cache.set(docId, text)
}

export function getLargeDocText(docId: string): string | null {
  return cache.get(docId) ?? null
}

export function deleteLargeDocText(docId: string): void {
  cache.delete(docId)
}
