import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, string>) => api.settings.update(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }) },
  })
}
