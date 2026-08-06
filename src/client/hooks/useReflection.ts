import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

/** A single day's reflection. Resolves to null when nothing is written yet. */
export function useReflection(date: string) {
  return useQuery({
    queryKey: ['reflections', date],
    enabled: !!date,
    queryFn: async () => {
      try {
        return await api.reflections.get(date)
      } catch {
        // The server 404s for an unwritten day, which is a normal empty state.
        return null
      }
    },
  })
}

export function useUpsertReflection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.reflections.upsert(data),
    onSuccess: (_res, vars: any) => {
      qc.invalidateQueries({ queryKey: ['reflections'] })
      if (vars?.date) qc.invalidateQueries({ queryKey: ['reflections', vars.date] })
    },
  })
}
