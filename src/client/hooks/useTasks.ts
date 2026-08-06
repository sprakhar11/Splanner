import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'

export function useTasks(params?: { from?: string; to?: string; categoryId?: string; status?: string }) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.tasks.list(params),
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id),
    enabled: !!id,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.tasks.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }) },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.tasks.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }) },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scope = 'one' }: { id: string; scope?: 'one' | 'future' | 'series' }) =>
      api.tasks.delete(id, scope),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }) },
  })
}

/** Subtasks for one task. Kept separate so the editor can load them lazily. */
export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: () => api.tasks.subtasks.list(taskId!),
    enabled: !!taskId,
  })
}

export function useSubtaskMutations(taskId: string | undefined) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['subtasks', taskId] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const add = useMutation({
    mutationFn: (title: string) => api.tasks.subtasks.create(taskId!, { title }),
    onSuccess: invalidate,
  })

  const toggle = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      api.tasks.subtasks.update(taskId!, id, { isCompleted }),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.tasks.subtasks.update(taskId!, id, { title }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.tasks.subtasks.delete(taskId!, id),
    onSuccess: invalidate,
  })

  return { add, toggle, rename, remove }
}
