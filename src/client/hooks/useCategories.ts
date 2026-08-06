import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.categories.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }) },
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.categories.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }) },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.categories.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }) },
  })
}
