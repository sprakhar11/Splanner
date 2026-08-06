import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: () => api.notes.list(),
  })
}

export function useNote(id: string) {
  return useQuery({
    queryKey: ['notes', id],
    queryFn: () => api.notes.get(id),
    enabled: !!id,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.notes.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }) },
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.notes.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }) },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.notes.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }) },
  })
}
