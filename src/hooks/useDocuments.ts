'use client'
import useSWR from 'swr'

export interface Document {
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

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<Document[]>

export function useDocuments() {
  const { data, mutate, error, isLoading } = useSWR<Document[]>('/api/documents', fetcher)

  function addOptimistic(doc: Document) {
    mutate(prev => [doc, ...(prev ?? [])], false)
  }

  async function toggleStar(id: string) {
    const doc = data?.find(d => d.id === id)
    if (!doc) return
    const optimistic = (data ?? []).map(d => d.id === id ? { ...d, starred: !d.starred } : d)
    mutate(
      async () => {
        await fetch('/api/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, starred: !doc.starred }),
        })
        return optimistic
      },
      { optimisticData: optimistic, rollbackOnError: true }
    )
  }

  async function deleteDocument(id: string) {
    const optimistic = (data ?? []).filter(d => d.id !== id)
    mutate(
      async () => {
        await fetch('/api/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        return optimistic
      },
      { optimisticData: optimistic, rollbackOnError: true }
    )
  }

  return {
    documents: data ?? [],
    loading: isLoading,
    error,
    refetch: () => mutate(),
    addOptimistic,
    toggleStar,
    deleteDocument,
  }
}
