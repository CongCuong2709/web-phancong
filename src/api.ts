// ============================================================
// api.ts — HTTP client kết nối backend API
// Thay thế localStorage: mọi thao tác CRUD đều qua đây.
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API = `${BASE_URL}/api`;

// ============================================================
// Token management
// ============================================================
const TOKEN_KEY = 'phancong_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

// ============================================================
// HTTP helper
// ============================================================
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    if (res.status === 401) {
      // Token hết hạn → logout
      clearToken();
      window.location.reload();
    }
    throw new Error(msg);
  }
  return data as T;
}

function get<T>(path: string) { return request<T>('GET', path); }
function post<T>(path: string, body: unknown) { return request<T>('POST', path, body); }
function put<T>(path: string, body: unknown) { return request<T>('PUT', path, body); }
function del<T>(path: string) { return request<T>('DELETE', path); }

// ============================================================
// Auth API
// ============================================================
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    fullname: string;
    role: string;
    department: string;     // primary (back-compat)
    departments: string[];  // tất cả phòng user thuộc
  };
}

export const authApi = {
  login: (username: string, password: string) =>
    post<LoginResponse>('/auth/login', { username, password }),

  me: () => get<LoginResponse['user']>('/auth/me'),

  changePassword: (oldPassword: string, newPassword: string) =>
    post<{ message: string }>('/auth/change-password', { oldPassword, newPassword }),
};

// ============================================================
// Users API
// ============================================================
export interface UserRecord {
  id: string;
  username: string;
  fullname: string;
  role: string;
  department: string;
  departments: string[];
  active: number;
  created_at: string;
}

export const usersApi = {
  list: () => get<UserRecord[]>('/users'),
  byDepartment: (dept?: string) =>
    get<UserRecord[]>(dept ? `/users/by-department?dept=${encodeURIComponent(dept)}` : '/users/by-department'),
  departments: () => get<string[]>('/users/departments'),
  create: (data: { username: string; password: string; fullname: string; role: string; department?: string; departments?: string[] }) =>
    post<UserRecord>('/users', data),
  update: (id: string, data: Partial<{ fullname: string; role: string; department: string; departments: string[]; active: boolean }>) =>
    put<{ message: string }>(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    post<{ message: string }>(`/users/${id}/reset-password`, { newPassword }),
  deactivate: (id: string) =>
    del<{ message: string }>(`/users/${id}`),
};

// ============================================================
// Tasks API (legacy — Hạng mục / Đầu việc qua /tasks endpoint)
// ============================================================
export interface TaskPayload {
  code?: string;
  name: string;
  description?: string;
  department?: string;
  collaboratingDepts?: string[];
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  status?: string;
  priority?: string;
  results?: string;
  notes?: string;
  tags?: string[];
}

export interface SubTaskPayload {
  name: string;
  description?: string;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  status?: string;
  priority?: string;
  results?: string;
  notes?: string;
  tags?: string[];
  /** Chỉ dùng khi tạo SubTask qua project modal — không bắt buộc */
  parentTaskId?: never;
}

export interface DailyLogPayload {
  date: string;
  description?: string;
  result?: string;
  obstacle?: string;
  progress?: number;
}

export const tasksApi = {
  list: () => get<import('./types').Project[]>('/tasks'),
  get: (id: string) => get<import('./types').Project>(`/tasks/${id}`),
  create: (data: TaskPayload) => post<import('./types').Project>('/tasks', data),
  update: (id: string, data: Partial<TaskPayload>) => put<import('./types').Project>(`/tasks/${id}`, data),
  delete: (id: string) => del<{ message: string }>(`/tasks/${id}`),

  // SubTasks
  createSubTask: (taskId: string, data: SubTaskPayload) =>
    post<import('./types').SubTask>(`/tasks/${taskId}/subtasks`, data),
  updateSubTask: (taskId: string, subId: string, data: Partial<SubTaskPayload>) =>
    put<import('./types').SubTask>(`/tasks/${taskId}/subtasks/${subId}`, data),
  deleteSubTask: (taskId: string, subId: string) =>
    del<{ message: string }>(`/tasks/${taskId}/subtasks/${subId}`),

  // Daily Logs
  addLog: (taskId: string, subId: string, data: DailyLogPayload) =>
    post<import('./types').DailyLog>(`/tasks/${taskId}/subtasks/${subId}/logs`, data),
  getLogs: (taskId: string, subId: string) =>
    get<import('./types').DailyLog[]>(`/tasks/${taskId}/subtasks/${subId}/logs`),
};

// ============================================================
// 4-Tier API — Dự án / Giai đoạn / Hạng mục giao
// ============================================================

interface ConstructionProjectRecord {
  id: string; code: string; name: string; description: string; address: string;
  project_manager_id?: string; project_manager_name?: string;
  target_start: string; target_end: string; actual_end?: string;
  status: string; budget?: number; created_by: string;
  created_at: string; updated_at: string;
  phases?: PhaseRecord[];
}

interface PhaseRecord {
  id: string; project_id: string; name: string; sequence: number;
  description?: string; target_start: string; target_end: string;
  actual_start?: string; actual_end?: string; status: string;
  created_at: string; updated_at: string;
  bundles?: BundleRecord[];
}

export interface BundleRecord {
  id: string; code: string; name: string; description: string;
  project_id: string; phase_id?: string; owner_id: string;
  department: string; start_date: string; due_date: string;
  status: string; progress: number; priority: string;
  notes?: string; tags?: string; budget?: number;
  collaborating_depts?: string; block_reason?: string;
  created_by: string; created_at: string; updated_at: string;
  owner_name?: string; project_name?: string; phase_name?: string;
  tasks?: import('./types').SubTask[];
}

function mapBundle(r: BundleRecord): import('./types').AssignmentBundle {
  const safeParse = (s?: string) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
  return {
    id: r.id, code: r.code, name: r.name, description: r.description,
    projectId: r.project_id, projectName: r.project_name,
    phaseId: r.phase_id, phaseName: r.phase_name,
    ownerId: r.owner_id, ownerName: r.owner_name,
    department: r.department, startDate: r.start_date, dueDate: r.due_date,
    status: r.status as import('./types').BundleStatus,
    progress: r.progress, priority: r.priority as import('./types').Priority,
    notes: r.notes, tags: safeParse(r.tags), budget: r.budget,
    collaboratingDepts: safeParse(r.collaborating_depts),
    blockReason: r.block_reason,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
    tasks: r.tasks,
  };
}

function mapPhase(r: PhaseRecord): import('./types').ProjectPhase {
  return {
    id: r.id, projectId: r.project_id, name: r.name, sequence: r.sequence,
    description: r.description, targetStart: r.target_start, targetEnd: r.target_end,
    actualStart: r.actual_start, actualEnd: r.actual_end,
    status: r.status as import('./types').PhaseStatus,
    createdAt: r.created_at, updatedAt: r.updated_at,
    bundles: (r.bundles || []).map(mapBundle),
  };
}

function mapConstructionProject(r: ConstructionProjectRecord): import('./types').ConstructionProject {
  return {
    id: r.id, code: r.code, name: r.name, description: r.description, address: r.address,
    projectManagerId: r.project_manager_id, projectManager: r.project_manager_name,
    targetStart: r.target_start, targetEnd: r.target_end, actualEnd: r.actual_end,
    status: r.status as import('./types').ConstructionProjectStatus,
    budget: r.budget, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
    phases: (r.phases || []).map(mapPhase),
  };
}

/** API cho Dự án xây dựng */
export const projectsApi = {
  list: () => get<ConstructionProjectRecord[]>('/projects').then((d) => d.map(mapConstructionProject)),
  get:  (id: string) => get<ConstructionProjectRecord>(`/projects/${id}`).then(mapConstructionProject),
  create: (data: Record<string, unknown>) =>
    post<ConstructionProjectRecord>('/projects', data).then(mapConstructionProject),
  update: (id: string, data: Record<string, unknown>) =>
    put<{ message: string }>(`/projects/${id}`, data),
  delete: (id: string) => del<{ message: string }>(`/projects/${id}`),
};

/** API cho Hạng mục giao (Bundles) */
export const bundlesApi = {
  list: (params?: { projectId?: string; dept?: string; status?: string }) => {
    const qs = params
      ? '?' + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
      : '';
    return get<BundleRecord[]>(`/bundles${qs}`).then((d) => d.map(mapBundle));
  },
  get:    (id: string) => get<BundleRecord>(`/bundles/${id}`).then(mapBundle),
  create: (data: Record<string, unknown>) =>
    post<BundleRecord>('/bundles', data).then(mapBundle),
  update: (id: string, data: Record<string, unknown>) =>
    put<{ message: string }>(`/bundles/${id}`, data),
  delete: (id: string) => del<{ message: string }>(`/bundles/${id}`),
};

/** API cho Giai đoạn */
export const phasesApi = {
  list: (projectId: string) =>
    get<PhaseRecord[]>(`/projects/${projectId}/phases`).then((d) => d.map(mapPhase)),
};
