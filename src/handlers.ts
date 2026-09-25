// ============================================================
// Event handlers — auth, CRUD, navigation, modal flows
// Phiên bản v3: dùng backend API thay localStorage
// ============================================================
import type { Project, SubTask, CurrentUser, Role, View } from './types';
import { state } from './state';
import { saveCurrentUser } from './storage';
import { authApi, tasksApi, usersApi, setToken, clearToken, type TaskPayload, type SubTaskPayload, type DailyLogPayload } from './api';
import { showToast, openModal, closeModal, setText, refreshIcons } from './ui';
import { ROLE_LABEL, today } from './utils';
import {
  renderDashboard,
  renderProjects,
  renderMyTasks,
  renderReports,
  populateDeptFilter,
  renderDetailBody,
} from './render';
import { renderDailyReport } from './renderDailyReport';


// ============================================================
// Auth — show / hide login & app screens
// ============================================================
export function showLogin(): void {
  document.getElementById('loginScreen')?.classList.remove('hidden');
  document.getElementById('appScreen')?.classList.add('hidden');
}

export function showApp(): void {
  document.getElementById('loginScreen')?.classList.add('hidden');
  document.getElementById('appScreen')?.classList.remove('hidden');

  if (state.currentUser) {
    const roleText = ROLE_LABEL[state.currentUser.role] ?? state.currentUser.role;
    setText('userInfo', `${state.currentUser.name} • ${roleText} • ${state.currentUser.department}`);

    const todayStr = new Date().toLocaleDateString('vi-VN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    setText('dashboardGreeting', `Hôm nay ${todayStr}. Chào mừng ${state.currentUser.name}!`);
  }

  applyRolePermissions();
  // Tải dữ liệu ban đầu từ API
  void loadInitialData();
  refreshIcons();
}

/** Tải danh sách tasks + users/departments từ backend */
async function loadInitialData(): Promise<void> {
  try {
    state.loading = true;

    // Tải song song
    const [tasks, departments, users] = await Promise.all([
      tasksApi.list(),
      usersApi.departments(),
      usersApi.byDepartment(),
    ]);

    state.projects = tasks;
    state.departments = departments;
    state.allUsers = users;

    populateDeptFilter();
    navigateTo('dashboard');
  } catch (err) {
    showToast('Không thể tải dữ liệu từ server. Kiểm tra kết nối.', true);
    console.error(err);
  } finally {
    state.loading = false;
  }
}

/** Reload tasks từ API và re-render view hiện tại */
async function reloadTasks(): Promise<void> {
  try {
    state.projects = await tasksApi.list();
    navigateTo(state.currentView);
  } catch (err) {
    showToast('Lỗi cập nhật dữ liệu', true);
    console.error(err);
  }
}

export async function handleLogin(): Promise<void> {
  const usernameEl = document.getElementById('loginUsername') as HTMLInputElement | null;
  const passwordEl = document.getElementById('loginPassword') as HTMLInputElement | null;
  if (!usernameEl || !passwordEl) return;

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (!username || !password) {
    showToast('Vui lòng nhập tên đăng nhập và mật khẩu', true);
    return;
  }

  // Hiển thị trạng thái đang đăng nhập
  const btnEl = document.getElementById('loginBtn') as HTMLButtonElement | null;
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Đang đăng nhập...'; }

  try {
    const { token, user } = await authApi.login(username, password);
    setToken(token);

    const currentUser: CurrentUser = {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      name: user.fullname,
      department: user.department,
      loginAt: new Date().toISOString(),
    };
    state.currentUser = currentUser;
    saveCurrentUser(currentUser);
    showApp();
    showToast(`Xin chào ${user.fullname}!`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
    showToast(msg, true);
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Đăng nhập'; }
  }
}

export function handleLogout(): void {
  if (!window.confirm('Bạn có chắc muốn đăng xuất?')) return;
  state.currentUser = null;
  state.projects = [];
  clearToken();
  saveCurrentUser(null);
  showLogin();
}

function applyRolePermissions(): void {
  const role = state.currentUser?.role;
  const canCreate = role === 'director' || role === 'manager' || role === 'admin';

  document.querySelectorAll<HTMLButtonElement>('[data-action="open-project-modal"]').forEach((b) => {
    b.style.display = canCreate ? '' : 'none';
  });

  const reportsNavBtn = document.querySelector<HTMLButtonElement>('[data-nav="reports"]');
  if (reportsNavBtn) {
    reportsNavBtn.style.display = role === 'employee' ? 'none' : '';
  }
}

// ============================================================
// Navigation
// ============================================================
export function navigateTo(view: View): void {
  state.currentView = view;

  (['dashboard', 'projects', 'myTasks', 'reports', 'dailyReport'] as View[]).forEach((v) => {
    document.getElementById(`view-${v}`)?.classList.add('hidden');
  });
  document.getElementById(`view-${view}`)?.classList.remove('hidden');

  document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => btn.classList.remove('active'));
  document.querySelector<HTMLButtonElement>(`[data-nav="${view}"]`)?.classList.add('active');

  switch (view) {
    case 'dashboard':    renderDashboard();    break;
    case 'projects':     renderProjects();     break;
    case 'myTasks':      renderMyTasks();      break;
    case 'reports':      renderReports();      break;
    case 'dailyReport':  renderDailyReport();  break;
  }
  refreshIcons();
}

// ============================================================
// Project modal (create / edit)
// ============================================================
export function openProjectModal(id?: string): void {
  const form = document.getElementById('projectForm') as HTMLFormElement | null;
  if (!form) return;
  form.reset();

  document.querySelectorAll<HTMLInputElement>('input[name="collabDept"]').forEach((cb) => {
    cb.checked = false;
  });

  const idEl = document.getElementById('projectId') as HTMLInputElement | null;
  if (idEl) idEl.value = '';

  const titleEl = document.getElementById('projectModalTitle');

  if (id) {
    const p = state.projects.find((x) => x.id === id);
    if (!p) return;
    if (titleEl) titleEl.textContent = 'Sửa công việc';

    (document.getElementById('fCode') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fCode') as HTMLInputElement).value = p.code || '');
    (document.getElementById('fName') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fName') as HTMLInputElement).value = p.name || '');
    (document.getElementById('fDescription') as HTMLTextAreaElement | null)?.value !== undefined &&
      ((document.getElementById('fDescription') as HTMLTextAreaElement).value = p.description || '');
    (document.getElementById('fDept') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fDept') as HTMLSelectElement).value = p.department || '');
    (document.getElementById('fAssigneeId') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fAssigneeId') as HTMLSelectElement).value = p.assigneeId || '');
    (document.getElementById('fStartDate') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fStartDate') as HTMLInputElement).value = p.startDate || '');
    (document.getElementById('fEndDate') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fEndDate') as HTMLInputElement).value = p.endDate || '');
    (document.getElementById('fPriority') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fPriority') as HTMLSelectElement).value = p.priority || 'medium');
    (document.getElementById('fProgress') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fProgress') as HTMLInputElement).value = String(p.progress || 0));
    (document.getElementById('fResults') as HTMLTextAreaElement | null)?.value !== undefined &&
      ((document.getElementById('fResults') as HTMLTextAreaElement).value = p.results || '');
    (document.getElementById('fStatus') as HTMLSelectElement | null)?.value !== undefined &&
      ((document.getElementById('fStatus') as HTMLSelectElement).value = p.status || 'not_started');
    if (idEl) idEl.value = p.id;

    const collabDepts = p.collaboratingDepts || [];
    document.querySelectorAll<HTMLInputElement>('input[name="collabDept"]').forEach((cb) => {
      cb.checked = collabDepts.includes(cb.value);
    });
  } else {
    if (titleEl) titleEl.textContent = 'Tạo công việc mới';
    (document.getElementById('fStartDate') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fStartDate') as HTMLInputElement).value = today());
    const nextNo = String(state.projects.length + 1).padStart(3, '0');
    (document.getElementById('fCode') as HTMLInputElement | null)?.value !== undefined &&
      ((document.getElementById('fCode') as HTMLInputElement).value = `DA${nextNo}`);
  }

  // Populate assignee dropdown từ danh sách users
  populateAssigneeDropdown('fAssigneeId');

  openModal('projectModal');
  refreshIcons();
}

export function closeProjectModal(): void {
  closeModal('projectModal');
}

function populateAssigneeDropdown(selectId: string, deptFilter?: string): void {
  const el = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!el) return;
  const current = el.value;
  const users = deptFilter
    ? state.allUsers.filter(u => u.department === deptFilter && (u.role === 'manager' || u.role === 'director'))
    : state.allUsers.filter(u => u.role === 'manager' || u.role === 'director');

  el.innerHTML = '<option value="">— Chọn người nhận —</option>' +
    users.map(u => `<option value="${u.id}">${u.fullname} (${u.department})</option>`).join('');
  if (current) el.value = current;
}

function populateEmployeeDropdown(selectId: string): void {
  const el = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!el) return;
  const current = el.value;
  const users = state.allUsers.filter(u => u.role === 'employee' || u.role === 'manager');
  el.innerHTML = '<option value="">— Chọn nhân viên —</option>' +
    users.map(u => `<option value="${u.id}">${u.fullname} (${u.department})</option>`).join('');
  if (current) el.value = current;
}

function readProjectForm(): TaskPayload | null {
  const code = (document.getElementById('fCode') as HTMLInputElement | null)?.value.trim() ?? '';
  const name = (document.getElementById('fName') as HTMLInputElement | null)?.value.trim() ?? '';
  const description = (document.getElementById('fDescription') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const department = (document.getElementById('fDept') as HTMLSelectElement | null)?.value ?? '';
  const assigneeId = (document.getElementById('fAssigneeId') as HTMLSelectElement | null)?.value ?? '';
  const startDate = (document.getElementById('fStartDate') as HTMLInputElement | null)?.value ?? '';
  const endDate = (document.getElementById('fEndDate') as HTMLInputElement | null)?.value ?? '';
  const priority = ((document.getElementById('fPriority') as HTMLSelectElement | null)?.value as 'low' | 'medium' | 'high') || 'medium';
  const progress = Number((document.getElementById('fProgress') as HTMLInputElement | null)?.value ?? 0);
  const results = (document.getElementById('fResults') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const status = ((document.getElementById('fStatus') as HTMLSelectElement | null)?.value as Project['status']) || 'not_started';

  const collaboratingDepts: string[] = [];
  document.querySelectorAll<HTMLInputElement>('input[name="collabDept"]:checked').forEach((cb) => {
    if (cb.value !== department) collaboratingDepts.push(cb.value);
  });

  if (!name) return null;

  return { code, name, description, department, collaboratingDepts, assigneeId: assigneeId || undefined, startDate, endDate, priority, progress, results, status };
}

export function handleSaveProject(e: Event): void {
  e.preventDefault();
  const id = (document.getElementById('projectId') as HTMLInputElement | null)?.value ?? '';
  const data = readProjectForm();
  if (!data) {
    showToast('Vui lòng nhập tên công việc', true);
    return;
  }

  const btn = document.querySelector<HTMLButtonElement>('#projectForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  const save = id
    ? tasksApi.update(id, data)
    : tasksApi.create(data);

  save
    .then(() => {
      showToast(id ? 'Đã cập nhật công việc' : 'Đã tạo công việc mới');
      closeProjectModal();
      return reloadTasks();
    })
    .catch((err: Error) => {
      showToast(err.message || 'Lỗi lưu công việc', true);
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; }
    });
}

export function confirmDelete(id: string): void {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  if (!window.confirm(`Xóa công việc "${p.code} - ${p.name}"?\nHành động này không thể hoàn tác.`)) return;

  tasksApi.delete(id)
    .then(() => {
      showToast('Đã xóa công việc');
      return reloadTasks();
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi xóa công việc', true));
}

// ============================================================
// SubTask modal (create / edit) — Trưởng phòng dùng
// ============================================================
export function openSubTaskModal(projectId: string, subTaskId?: string): void {
  const form = document.getElementById('subTaskForm') as HTMLFormElement | null;
  if (!form) return;
  form.reset();

  const pidEl = document.getElementById('stProjectId') as HTMLInputElement | null;
  const sidEl = document.getElementById('stSubTaskId') as HTMLInputElement | null;
  if (pidEl) pidEl.value = projectId;
  if (sidEl) sidEl.value = '';

  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;

  const titleEl = document.getElementById('subTaskModalTitle');

  if (subTaskId) {
    const st = p.subTasks?.find((s) => s.id === subTaskId);
    if (!st) return;
    if (titleEl) titleEl.textContent = 'Sửa công việc con';
    if (sidEl) sidEl.value = st.id;

    (document.getElementById('stName') as HTMLInputElement | null) &&
      ((document.getElementById('stName') as HTMLInputElement).value = st.name || '');
    (document.getElementById('stDescription') as HTMLTextAreaElement | null) &&
      ((document.getElementById('stDescription') as HTMLTextAreaElement).value = st.description || '');
    (document.getElementById('stStartDate') as HTMLInputElement | null) &&
      ((document.getElementById('stStartDate') as HTMLInputElement).value = st.startDate || '');
    (document.getElementById('stEndDate') as HTMLInputElement | null) &&
      ((document.getElementById('stEndDate') as HTMLInputElement).value = st.endDate || '');
    (document.getElementById('stPriority') as HTMLSelectElement | null) &&
      ((document.getElementById('stPriority') as HTMLSelectElement).value = st.priority || 'medium');
    (document.getElementById('stStatus') as HTMLSelectElement | null) &&
      ((document.getElementById('stStatus') as HTMLSelectElement).value = st.status || 'not_started');
  } else {
    if (titleEl) titleEl.textContent = 'Thêm công việc con';
    (document.getElementById('stStartDate') as HTMLInputElement | null) &&
      ((document.getElementById('stStartDate') as HTMLInputElement).value = today());
    (document.getElementById('stEndDate') as HTMLInputElement | null) &&
      ((document.getElementById('stEndDate') as HTMLInputElement).value = p.endDate || '');
  }

  // Populate nhân viên dropdown
  populateEmployeeDropdown('stAssigneeId');
  if (subTaskId) {
    const st = p.subTasks?.find((s) => s.id === subTaskId);
    if (st?.assigneeId) {
      const sel = document.getElementById('stAssigneeId') as HTMLSelectElement | null;
      if (sel) sel.value = st.assigneeId;
    }
  }

  openModal('subTaskModal');
  refreshIcons();
}

export function closeSubTaskModal(): void {
  closeModal('subTaskModal');
}

export function handleSaveSubTask(e: Event): void {
  e.preventDefault();
  const projectId = (document.getElementById('stProjectId') as HTMLInputElement | null)?.value ?? '';
  const subTaskId = (document.getElementById('stSubTaskId') as HTMLInputElement | null)?.value ?? '';

  const name = (document.getElementById('stName') as HTMLInputElement | null)?.value.trim() ?? '';
  const description = (document.getElementById('stDescription') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const assigneeId = (document.getElementById('stAssigneeId') as HTMLSelectElement | null)?.value ?? '';
  const startDate = (document.getElementById('stStartDate') as HTMLInputElement | null)?.value ?? '';
  const endDate = (document.getElementById('stEndDate') as HTMLInputElement | null)?.value ?? '';
  const priority = ((document.getElementById('stPriority') as HTMLSelectElement | null)?.value as SubTask['priority']) || 'medium';
  const status = ((document.getElementById('stStatus') as HTMLSelectElement | null)?.value as SubTask['status']) || 'not_started';

  if (!name) {
    showToast('Vui lòng nhập tên công việc con', true);
    return;
  }

  const payload: SubTaskPayload = { name, description, assigneeId: assigneeId || undefined, startDate, endDate, priority, status };

  const btn = document.querySelector<HTMLButtonElement>('#subTaskForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  const save = subTaskId
    ? tasksApi.updateSubTask(projectId, subTaskId, payload)
    : tasksApi.createSubTask(projectId, payload);

  save
    .then(() => {
      showToast(subTaskId ? 'Đã cập nhật công việc con' : 'Đã thêm công việc con');
      closeSubTaskModal();
      return reloadTasks();
    })
    .then(() => {
      // Re-render detail modal nếu đang mở
      const detailModal = document.getElementById('detailModal');
      if (detailModal && !detailModal.classList.contains('hidden')) {
        const p = state.projects.find((x) => x.id === projectId);
        if (p) renderDetailBody(p);
      }
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi lưu', true))
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; }
    });
}

export function confirmDeleteSubTask(projectId: string, subTaskId: string): void {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;
  const st = p.subTasks?.find((s) => s.id === subTaskId);
  if (!st) return;
  if (!window.confirm(`Xóa công việc con "${st.name}"?\nHành động này không thể hoàn tác.`)) return;

  tasksApi.deleteSubTask(projectId, subTaskId)
    .then(() => {
      showToast('Đã xóa công việc con');
      return reloadTasks();
    })
    .then(() => {
      const detailModal = document.getElementById('detailModal');
      if (detailModal && !detailModal.classList.contains('hidden')) {
        const p2 = state.projects.find((x) => x.id === projectId);
        if (p2) renderDetailBody(p2);
      }
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi xóa', true));
}

// ============================================================
// Daily Log modal — nhân viên điền nhật ký hằng ngày
// ============================================================
export function openDailyLogModal(projectId: string, subTaskId?: string): void {
  const pidEl = document.getElementById('dlProjectId') as HTMLInputElement | null;
  const sidEl = document.getElementById('dlSubTaskId') as HTMLInputElement | null;
  if (pidEl) pidEl.value = projectId;
  if (sidEl) sidEl.value = subTaskId || '';

  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;

  let currentProgress = 0;

  if (subTaskId) {
    const st = p.subTasks?.find((s) => s.id === subTaskId);
    if (!st) return;
    currentProgress = st.progress;

    const todayStr = today();
    const existingLog = st.dailyLogs?.find((l) => l.date === todayStr);

    (document.getElementById('dlDescription') as HTMLTextAreaElement | null)!.value = existingLog?.description || '';
    (document.getElementById('dlResult') as HTMLTextAreaElement | null)!.value = existingLog?.result || '';
    (document.getElementById('dlObstacle') as HTMLTextAreaElement | null)!.value = existingLog?.obstacle || '';

    const titleEl = document.getElementById('dlSubTaskName');
    if (titleEl) titleEl.textContent = st.name;
  } else {
    currentProgress = p.progress;
    const titleEl = document.getElementById('dlSubTaskName');
    if (titleEl) titleEl.textContent = p.name;
    (document.getElementById('dlDescription') as HTMLTextAreaElement | null)!.value = '';
    (document.getElementById('dlResult') as HTMLTextAreaElement | null)!.value = p.results || '';
    (document.getElementById('dlObstacle') as HTMLTextAreaElement | null)!.value = '';
  }

  const dlProgressEl = document.getElementById('dlProgress') as HTMLInputElement | null;
  if (dlProgressEl) {
    dlProgressEl.value = String(currentProgress);
    const labelEl = document.getElementById('dlProgressLabel');
    if (labelEl) labelEl.textContent = `${currentProgress}%`;
  }

  openModal('dailyLogModal');
  refreshIcons();
}

export function closeDailyLogModal(): void {
  closeModal('dailyLogModal');
}

export function handleSaveDailyLog(e: Event): void {
  e.preventDefault();
  const projectId = (document.getElementById('dlProjectId') as HTMLInputElement | null)?.value ?? '';
  const subTaskId = (document.getElementById('dlSubTaskId') as HTMLInputElement | null)?.value ?? '';

  const description = (document.getElementById('dlDescription') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const result = (document.getElementById('dlResult') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const obstacle = (document.getElementById('dlObstacle') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  const newProgress = Number((document.getElementById('dlProgress') as HTMLInputElement | null)?.value ?? 0);

  if (newProgress < 0 || newProgress > 100) {
    showToast('Tiến độ phải từ 0 - 100', true);
    return;
  }

  const btn = document.querySelector<HTMLButtonElement>('#dailyLogForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

  let savePromise: Promise<unknown>;

  if (subTaskId) {
    const logPayload: DailyLogPayload = {
      date: today(),
      description,
      result,
      obstacle,
      progress: newProgress,
    };
    savePromise = tasksApi.addLog(projectId, subTaskId, logPayload);
  } else {
    // Cập nhật trực tiếp Task nếu không có subtask
    savePromise = tasksApi.update(projectId, { progress: newProgress, results: result });
  }

  savePromise
    .then(() => {
      showToast('Đã lưu nhật ký hôm nay');
      closeDailyLogModal();
      return reloadTasks();
    })
    .catch((err: Error) => showToast(err.message || 'Lỗi lưu nhật ký', true))
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'Lưu nhật ký'; }
    });
}

// ============================================================
// Progress modal (legacy aliases)
// ============================================================
export function openProgressModal(id: string): void { openDailyLogModal(id); }
export function closeProgressModal(): void { closeDailyLogModal(); }
export function handleSaveProgress(e: Event): void { handleSaveDailyLog(e); }

// ============================================================
// Detail modal
// ============================================================
export function openDetailModal(id: string): void {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  renderDetailBody(p);
  openModal('detailModal');
}

export function closeDetailModal(): void {
  closeModal('detailModal');
}
