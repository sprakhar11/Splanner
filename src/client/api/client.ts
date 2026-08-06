const API_BASE = '/api'

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Tasks
  tasks: {
    list: (params?: { from?: string; to?: string; categoryId?: string; status?: string }) => {
      const qs = new URLSearchParams(params as any).toString()
      return request<any[]>(`/tasks${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<any>(`/tasks/${id}`),
    create: (data: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    /** scope: 'one' (default), 'future', or 'series'. */
    delete: (id: string, scope: 'one' | 'future' | 'series' = 'one') =>
      request<any>(`/tasks/${id}?scope=${scope}`, { method: 'DELETE' }),

    subtasks: {
      list: (taskId: string) => request<any[]>(`/tasks/${taskId}/subtasks`),
      create: (taskId: string, data: any) =>
        request<any>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(data) }),
      update: (taskId: string, subId: string, data: any) =>
        request<any>(`/tasks/${taskId}/subtasks/${subId}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (taskId: string, subId: string) =>
        request<any>(`/tasks/${taskId}/subtasks/${subId}`, { method: 'DELETE' }),
    },
  },

  // Notes
  notes: {
    list: () => request<any[]>('/notes'),
    get: (id: string) => request<any>(`/notes/${id}`),
    create: (data: any) => request<any>('/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/notes/${id}`, { method: 'DELETE' }),
  },

  // Revisions
  revisions: {
    list: () => request<any[]>('/revisions'),
    due: () => request<any[]>('/revisions/due'),
    get: (id: string) => request<any>(`/revisions/${id}`),
    create: (data: any) => request<any>('/revisions', { method: 'POST', body: JSON.stringify(data) }),
    grade: (id: string, grade: string) => request<any>(`/revisions/${id}/grade`, { method: 'POST', body: JSON.stringify({ grade }) }),
    delete: (id: string) => request<any>(`/revisions/${id}`, { method: 'DELETE' }),
  },

  // Categories
  categories: {
    list: () => request<any[]>('/categories'),
    create: (data: any) => request<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/categories/${id}`, { method: 'DELETE' }),
    restoreDefaults: () => request<any[]>('/categories/restore-defaults', { method: 'POST' }),
  },

  // Interview Items (unified)
  interviewItems: {
    list: (topic?: string) => {
      const qs = topic ? `?topic=${encodeURIComponent(topic)}` : ''
      return request<any[]>(`/interview-items${qs}`)
    },
    get: (id: string) => request<any>(`/interview-items/${id}`),
    create: (data: any) => request<any>('/interview-items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/interview-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    revise: (id: string, grade: string) => request<any>(`/interview-items/${id}/revise`, { method: 'POST', body: JSON.stringify({ grade }) }),
    delete: (id: string) => request<any>(`/interview-items/${id}`, { method: 'DELETE' }),
    stats: () => request<any>('/interview-items/stats/summary'),
  },
  // DSA (legacy, kept for backward compat during transition)
  dsa: {
    list: () => request<any[]>('/dsa'),
    get: (id: string) => request<any>(`/dsa/${id}`),
    create: (data: any) => request<any>('/dsa', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/dsa/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/dsa/${id}`, { method: 'DELETE' }),
  },

  // System Design
  systemDesign: {
    list: () => request<any[]>('/system-design'),
    get: (id: string) => request<any>(`/system-design/${id}`),
    create: (data: any) => request<any>('/system-design', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/system-design/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/system-design/${id}`, { method: 'DELETE' }),
  },

  // LLD
  lld: {
    list: () => request<any[]>('/lld'),
    get: (id: string) => request<any>(`/lld/${id}`),
    create: (data: any) => request<any>('/lld', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/lld/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/lld/${id}`, { method: 'DELETE' }),
  },

  // HR Stories
  hrStories: {
    list: () => request<any[]>('/hr-stories'),
    get: (id: string) => request<any>(`/hr-stories/${id}`),
    create: (data: any) => request<any>('/hr-stories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/hr-stories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/hr-stories/${id}`, { method: 'DELETE' }),
  },

  // Study Sessions
  studySessions: {
    list: (params?: { from?: string; to?: string }) => {
      const qs = new URLSearchParams(params as any).toString()
      return request<any[]>(`/study-sessions${qs ? `?${qs}` : ''}`)
    },
    create: (data: any) => request<any>('/study-sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/study-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/study-sessions/${id}`, { method: 'DELETE' }),
  },

  // Reflections
  reflections: {
    list: () => request<any[]>('/reflections'),
    get: (date: string) => request<any>(`/reflections/${date}`),
    upsert: (data: any) => request<any>('/reflections', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/reflections/${id}`, { method: 'DELETE' }),
  },

  // Settings
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    update: (data: Record<string, string>) => request<Record<string, string>>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Search
  search: (q: string) => request<any[]>(`/search?q=${encodeURIComponent(q)}`),

  // Backup
  backup: {
    exportUrl: () => `${API_BASE}/backup/export`,
    import: (json: string, mode: 'replace' | 'merge' = 'replace') =>
      request<any>(`/backup/import?mode=${mode}`, { method: 'POST', body: json, headers: { 'Content-Type': 'text/plain' } as any }),
  },
}
