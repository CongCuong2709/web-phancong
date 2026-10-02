// ============================================================
// main.ts — entry point v3 (backend API mode)
// ============================================================
import './styles.css';

import { state } from './state';
import { loadCurrentUser } from './storage';
import { getToken, authApi, setToken } from './api';
import { setupModalBackdropClose, setupEscapeClose, refreshIcons } from './ui';
import { getTheme, applyTheme, bindThemeSwitcher, initThemeListener, themeSwitcherHtml } from './theme';
import * as H from './handlers';
import * as DR from './dailyReportHandlers';
import * as ADM from './renderAdminUsers';
import { renderProjects } from './render';
import {
  renderConstructionProjects,
  toggleConstructionProject,
  togglePhase,
  toggleBundle,
  openBundleDetail,
} from './renderConstructionProjects';


import type { View, CurrentUser, Role } from './types';
import { saveCurrentUser } from './storage';

// ============================================================
// Expose handlers cho HTML render động
// ============================================================
declare global {
  interface Window {
    handleLogin: () => void;
    handleLogout: () => void;
    navigateTo: (view: string) => void;
    openProjectModal: (id?: string) => void;
    closeProjectModal: () => void;
    handleSaveProject: (e: Event) => void;
    confirmDelete: (id: string) => void;
    openSubTaskModal: (projectId: string, subTaskId?: string) => void;
    closeSubTaskModal: () => void;
    handleSaveSubTask: (e: Event) => void;
    confirmDeleteSubTask: (projectId: string, subTaskId: string) => void;
    openDailyLogModal: (projectId: string, subTaskId?: string) => void;
    closeDailyLogModal: () => void;
    handleSaveDailyLog: (e: Event) => void;
    openProgressModal: (id: string) => void;
    closeProgressModal: () => void;
    handleSaveProgress: (e: Event) => void;
    openDetailModal: (id: string) => void;
    closeDetailModal: () => void;
    // Daily Report tab
    toggleDailyReportRow: (rowId: string) => void;
    saveDailyReportRow: (taskId: string, subId: string, rowId: string) => void;
    submitAllDailyReports: () => void;
    // Admin: Quản lý người dùng
    openUserModal: (id?: string) => void;
    confirmDeleteUser: (id: string) => void;
    resetUserPassword: (id: string) => void;
    // 4-tier project hierarchy toggles
    toggleConstructionProject: (id: string) => void;
    togglePhase: (id: string) => void;
    toggleBundle: (id: string) => void;
    openBundleDetail: (id: string) => void;
    renderConstructionProjects: () => void;
  }
}


window.handleLogin    = () => { void H.handleLogin(); };
window.handleLogout   = () => H.handleLogout();
window.navigateTo     = (view: string) => H.navigateTo(view as View);

window.openProjectModal   = (id?: string) => H.openProjectModal(id);
window.closeProjectModal  = () => H.closeProjectModal();
window.handleSaveProject  = (e: Event) => H.handleSaveProject(e);
window.confirmDelete      = (id: string) => H.confirmDelete(id);

window.openSubTaskModal      = (projectId: string, subTaskId?: string) => H.openSubTaskModal(projectId, subTaskId);
window.closeSubTaskModal     = () => H.closeSubTaskModal();
window.handleSaveSubTask     = (e: Event) => H.handleSaveSubTask(e);
window.confirmDeleteSubTask  = (projectId: string, subTaskId: string) => H.confirmDeleteSubTask(projectId, subTaskId);

window.openDailyLogModal  = (projectId: string, subTaskId?: string) => H.openDailyLogModal(projectId, subTaskId);
window.closeDailyLogModal = () => H.closeDailyLogModal();
window.handleSaveDailyLog = (e: Event) => H.handleSaveDailyLog(e);

window.openProgressModal  = (id: string) => H.openProgressModal(id);
window.closeProgressModal = () => H.closeProgressModal();
window.handleSaveProgress = (e: Event) => H.handleSaveProgress(e);

window.openDetailModal  = (id: string) => H.openDetailModal(id);
window.closeDetailModal = () => H.closeDetailModal();

// 4-tier hierarchy toggles
window.toggleConstructionProject = (id: string) => toggleConstructionProject(id);
window.togglePhase  = (id: string) => togglePhase(id);
window.toggleBundle = (id: string) => toggleBundle(id);
window.openBundleDetail = (id: string) => openBundleDetail(id);
window.renderConstructionProjects = () => renderConstructionProjects();

// Daily Report handlers
window.toggleDailyReportRow   = (rowId: string) => DR.toggleDailyReportRow(rowId);
window.saveDailyReportRow     = (taskId: string, subId: string, rowId: string) => DR.saveDailyReportRow(taskId, subId, rowId);
window.submitAllDailyReports  = () => DR.submitAllDailyReports();

// Admin handlers
window.openUserModal        = (id?: string) => ADM.openUserModal(id);
window.confirmDeleteUser    = (id: string) => { void ADM.confirmDeleteUser(id); };
window.resetUserPassword    = (id: string) => { void ADM.resetUserPassword(id); };


// ============================================================
// Event delegation
// ============================================================
type ActionHandler = (target: HTMLElement) => void;

const ACTION_MAP: Record<string, ActionHandler> = {
  login:   () => { void H.handleLogin(); },
  logout:  () => H.handleLogout(),

  'open-project-modal': (t) => {
    const id = t.dataset.id;
    H.openProjectModal(id && id.length > 0 ? id : undefined);
  },
  'close-project-modal':  () => H.closeProjectModal(),
  'close-subtask-modal':  () => H.closeSubTaskModal(),
  'close-dailylog-modal': () => H.closeDailyLogModal(),
  'close-detail-modal':   () => H.closeDetailModal(),
  'close-user-modal':     () => ADM.closeUserModal(),
};

function handleClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const actionEl = target.closest<HTMLElement>('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action) {
      const handler = ACTION_MAP[action];
      if (handler) {
        e.preventDefault();
        handler(actionEl);
        return;
      }
    }
  }

  const navEl = target.closest<HTMLElement>('[data-nav]');
  if (navEl) {
    const view = navEl.dataset.nav as View | undefined;
    if (view) {
      e.preventDefault();
      H.navigateTo(view);
    }
  }
}

function handleSubmit(e: SubmitEvent): void {
  const form = e.target as HTMLFormElement | null;
  if (!form) return;

  if (form.id === 'loginForm') {
    e.preventDefault();
    void H.handleLogin();
  } else if (form.id === 'projectForm') {
    e.preventDefault();
    H.handleSaveProject(e);
  } else if (form.id === 'subTaskForm') {
    e.preventDefault();
    H.handleSaveSubTask(e);
  } else if (form.id === 'dailyLogForm') {
    e.preventDefault();
    H.handleSaveDailyLog(e);
  } else if (form.id === 'userForm') {
    e.preventDefault();
    void ADM.handleSaveUser(e);
  }
}

function handleInput(e: Event): void {
  const target = e.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target) return;
  const id = target.id;
  if (
    state.currentView === 'projects' &&
    (id === 'filterSearch' || id === 'filterDept' || id === 'filterStatus' || id === 'filterPriority' || id === 'filterTag')
  ) {
    renderProjects();
  }
  // Cập nhật label % progress trong daily log modal
  if (id === 'dlProgress') {
    const label = document.getElementById('dlProgressLabel');
    if (label) label.textContent = `${(target as HTMLInputElement).value}%`;
  }
}

function attachGlobalListeners(): void {
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
}

/** Auto-resize textarea + cập nhật char counter (nếu có <span data-counter-for="...">) */
function attachAutoResize(): void {
  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    const counterId = el.dataset.counterFor;
    if (counterId) {
      const counter = document.getElementById(counterId);
      if (counter) counter.textContent = `${el.value.length} ký tự`;
    }
  };
  document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autosize]').forEach((el) => {
    autosize(el);
    el.addEventListener('input', () => autosize(el));
  });
}

// ============================================================
// Boot
// ============================================================
async function init(): Promise<void> {
  // Theme bootstrap — áp dụng từ inline script đã chạy + lắng nghe thay đổi
  applyTheme(getTheme());
  initThemeListener();

  // Mount theme switcher ở login + navbar
  const loginMount = document.getElementById('loginThemeMount');
  if (loginMount) loginMount.innerHTML = themeSwitcherHtml(getTheme());
  const navMount = document.getElementById('navbarThemeMount');
  if (navMount) navMount.innerHTML = themeSwitcherHtml(getTheme());
  bindThemeSwitcher();

  // Hiển thị tài khoản mẫu chỉ khi dev (Vite inject import.meta.env.DEV)
  const devHint = document.getElementById('loginDevHint');
  if (devHint) {
    try {
      const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
      if (env && env.DEV) devHint.classList.remove('hidden');
    } catch { /* ignore */ }
  }

  setupModalBackdropClose();
  setupEscapeClose();
  attachGlobalListeners();
  attachAutoResize();
  refreshIcons();

  // Kiểm tra token + session còn hợp lệ không
  const token = getToken();
  const savedUser = loadCurrentUser();

  if (token && savedUser) {
    try {
      // Verify token với server
      const me = await authApi.me();
      const currentUser: CurrentUser = {
        id: me.id,
        username: me.username,
        role: me.role as Role,
        name: me.fullname,
        department: me.department,
        departments: me.departments ?? [me.department].filter(Boolean),
        loginAt: savedUser.loginAt,
      };
      state.currentUser = currentUser;
      saveCurrentUser(currentUser);
      H.showApp();
    } catch {
      // Token hết hạn
      H.showLogin();
    }
  } else {
    H.showLogin();
  }

  // Cập nhật highlight theme switcher khi theme đổi (cả login + nav)
  document.addEventListener('themechange', () => {
    const mode = getTheme();
    document.querySelectorAll<HTMLElement>('.theme-switcher').forEach((sw) => {
      sw.querySelectorAll<HTMLElement>('.theme-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.themeMode === mode);
      });
    });
  });

  console.info('✅ Phân công công việc v3 — Backend API mode');
}

void init();
