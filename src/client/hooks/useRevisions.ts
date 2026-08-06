import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useRevisions() {
  return useQuery({
    queryKey: ['revisions'],
    queryFn: () => api.revisions.list(),
  })
}

export function useRevisionsDue() {
  return useQuery({
    queryKey: ['revisions', 'due'],
    queryFn: () => api.revisions.due(),
  })
}

export function useRevision(id: string) {
  return useQuery({
    queryKey: ['revisions', id],
    queryFn: () => api.revisions.get(id),
    enabled: !!id,
  })
}

export function useCreateRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.revisions.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revisions'] }) },
  })
}

export function useGradeRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: string }) => api.revisions.grade(id, grade),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revisions'] }) },
  })
}

export function useDeleteRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revisions.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revisions'] }) },
  })
}
