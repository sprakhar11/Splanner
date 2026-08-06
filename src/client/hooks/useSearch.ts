import { useQuery } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.trim().length > 0,
    staleTime: 0,
  })
}
