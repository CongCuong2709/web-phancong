// ============================================================
// storage.ts — Chỉ còn lưu CurrentUser trong sessionStorage
// Dữ liệu projects giờ do backend quản lý qua api.ts
// ============================================================
import type { CurrentUser } from './types';

const CURRENT_USER_KEY = 'phancong_currentUser_v3';

export function loadCurrentUser(): CurrentUser | null {
  try {
    const raw = sessionStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: CurrentUser | null): void {
  try {
    if (user) sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CURRENT_USER_KEY);
  } catch (e) {
    console.error('Cannot save current user:', e);
  }
}
