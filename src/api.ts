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
// Tasks API
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
