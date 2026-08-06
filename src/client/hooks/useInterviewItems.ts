import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useInterviewItems(topic?: string) {
  return useQuery({
    queryKey: ['interviewItems', topic ?? 'all'],
    queryFn: () => api.interviewItems.list(topic),
  })
}

export function useInterviewItem(id: string) {
  return useQuery({
    queryKey: ['interviewItems', 'detail', id],
    queryFn: () => api.interviewItems.get(id),
    enabled: !!id,
  })
}

export function useCreateInterviewItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.interviewItems.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interviewItems'] }),
  })
}

export function useUpdateInterviewItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.interviewItems.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interviewItems'] }),
  })
}

export function useReviseInterviewItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: string }) => api.interviewItems.revise(id, grade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviewItems'] })
      qc.invalidateQueries({ queryKey: ['revisions'] })
    },
  })
}

export function useDeleteInterviewItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.interviewItems.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interviewItems'] }),
  })
}

export function useInterviewStats() {
  return useQuery({
    queryKey: ['interviewItems', 'stats'],
    queryFn: () => api.interviewItems.stats(),
  })
}
