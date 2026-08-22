import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'
import { useSettings } from '@client/hooks/useSettings'
import { logicalToday } from '@shared/day'
import { computeHabitState, type HabitLog, type HabitState, type HabitStatus } from '@client/lib/habits'

export type Habit = {
  id: string
  title: string
  plantType: string
  color: string | null
  archived: boolean
  position: number
  createdAt: number
  logs: HabitLog[]
}

/** A habit with its derived garden state attached. */
export type HabitWithState = Habit & { state: HabitState }

export function useHabits(includeArchived = false) {
  return useQuery({
    queryKey: ['habits', includeArchived],
    queryFn: () => api.habits.list(includeArchived) as Promise<Habit[]>,
  })
}

/**
 * The logical day, per the user's configured boundary.
 *
 * Habits deliberately do not use `todayISO()`. Someone who studies past midnight
 * with a 3 AM boundary would otherwise see their plants start wilting on a day
 * they have explicitly told the app is not over.
 */
export function useLogicalToday(): string {
  const { data: settings } = useSettings()
  return logicalToday(settings?.rolloverHour ?? 0)
}

/**
 * Habits with state derived against the logical today.
 *
 * Derivation happens here rather than on the server because it depends on that
 * boundary, and the client already holds the setting. One definition, one place.
 */
export function useGarden(includeArchived = false): {
  habits: HabitWithState[]
  today: string
  isLoading: boolean
} {
  const { data = [], isLoading } = useHabits(includeArchived)
  const today = useLogicalToday()

  return {
    habits: data.map(h => ({ ...h, state: computeHabitState(h.logs ?? [], today) })),
    today,
    isLoading,
  }
}

/**
 * Writes one day's log, optimistically.
 *
 * Every derived value — streak, stage, health — is computed from the `logs`
 * array, so patching that one array makes the whole plant react in the same
 * frame. Waiting for the round trip would put a visible stutter between the tap
 * and the animation, which is the one thing a habit tracker cannot afford.
 */
export function useLogHabit() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, date, status }: { id: string; date: string; status: HabitStatus | null }) =>
      api.habits.log(id, date, status),

    onMutate: async ({ id, date, status }) => {
      await qc.cancelQueries({ queryKey: ['habits'] })
      const snapshots = qc.getQueriesData<Habit[]>({ queryKey: ['habits'] })

      for (const [key, habits] of snapshots) {
        if (!habits) continue
        qc.setQueryData<Habit[]>(key, habits.map(h => {
          if (h.id !== id) return h
          const logs = (h.logs ?? []).filter(l => l.date !== date)
          return { ...h, logs: status === null ? logs : [...logs, { date, status }] }
        }))
      }

      return { snapshots }
    },

    onError: (_err, _vars, ctx) => {
      // Put the garden back exactly as it was rather than leaving a plant
      // showing a completion that never persisted.
      for (const [key, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, data)
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
    },
  })
}

export function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; plantType?: string; color?: string | null }) =>
      api.habits.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}

export function useUpdateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.habits.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}

/** Archives by default; logs are kept so re-enabling restores the history. */
export function useArchiveHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hard = false }: { id: string; hard?: boolean }) =>
      hard ? api.habits.remove(id) : api.habits.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}
