import { useQuery } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useStudySessions(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['studySessions', params],
    queryFn: () => api.studySessions.list(params),
  })
}

export function useReflections() {
  return useQuery({
    queryKey: ['reflections'],
    queryFn: () => api.reflections.list(),
  })
}
