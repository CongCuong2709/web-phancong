// ============================================================
// Module-level state (single source of truth)
// ============================================================
import type { Project, CurrentUser, View } from './types';

interface AppState {
  projects: Project[];
  currentUser: CurrentUser | null;
  currentView: View;
  /** Danh sách phòng ban (lấy từ API /users/departments) */
  departments: string[];
  /** Danh sách user active (để dropdown giao việc) */
  allUsers: Array<{ id: string; fullname: string; role: string; department: string }>;
  /** Loading state khi fetch API */
  loading: boolean;
}

export const state: AppState = {
  projects: [],
  currentUser: null,
  currentView: 'dashboard',
  departments: [],
  allUsers: [],
  loading: false,
};
