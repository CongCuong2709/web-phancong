// ============================================================
// renderProjects.ts — View "Dự án" với hierarchy 4 tầng
// Dự án → Giai đoạn → Hạng mục giao → Đầu việc
// ============================================================
import type { ConstructionProject, ProjectPhase, AssignmentBundle, SubTask } from './types';
import {
  CONSTRUCTION_STATUS_LABEL,
  BUNDLE_STATUS_LABEL,
  PHASE_STATUS_LABEL,
  PRIORITY_LABEL,
  escapeHtml,
  formatDate,
  formatCurrency,
  progressColor,
  constructionStatusCls,
  bundleStatusCls,
  phaseStatusCls,
  bundleStatusColor,
  computeProjectProgress,
} from './utils';
import { state } from './state';
import { refreshIcons } from './ui';

// ============================================================
// Helpers
// ============================================================
function progressCellsHtml(pct: number, colorVar: string): string {
  const filled = Math.round(pct / 10);
  let cells = '';
  for (let i = 0; i < 10; i++) {
    cells += `<span class="cell${i < filled ? ' on' : ''}"></span>`;
  }
  return `<span class="progress-cells" style="color: ${colorVar};" title="${pct}%">${cells}</span>`;
}

function statusDotHtml(statusCls: string, label: string): string {
  return `<span class="status-text ${statusCls}"><span class="dot"></span>${escapeHtml(label)}</span>`;
}

function collabBadgesHtml(depts: string[]): string {
  if (!depts?.length) return '';
  return depts.map((d) => `<span class="badge badge-collab">${escapeHtml(d)}</span>`).join('');
}

// ============================================================
// Subtask row (Đầu việc)
// ============================================================
function taskRowHtml(task: SubTask, bundleId: string): string {
  const pct = task.progress || 0;
  const statusCls = task.status === 'completed' ? 's-done' :
    task.status === 'in_progress' ? 's-doing' :
    task.status === 'on_hold' ? 's-block' : 's-todo';
  const statusLabel: Record<string, string> = {
    not_started: 'Chưa bắt đầu', in_progress: 'Đang làm',
    completed: 'Hoàn thành', on_hold: 'Tạm dừng',
  };
  return `
    <div class="bundle-task-row">
      <div class="bundle-task-info">
        <span class="status-text ${statusCls} text-xs"><span class="dot" style="width:6px;height:6px;"></span></span>
        <span class="text-sm text-t1 truncate flex-1">${escapeHtml(task.name)}</span>
        <span class="text-xs text-t2 whitespace-nowrap">${escapeHtml(task.assignee || '—')}</span>
        <span class="text-xs text-t3 font-mono whitespace-nowrap">Hạn: ${formatDate(task.endDate)}</span>
        <span class="font-mono text-xs font-semibold" style="color:${progressColor(pct)};min-width:32px;text-align:right">${pct}%</span>
      </div>
    </div>`;
}

// ============================================================
// Bundle card (Hạng mục giao)
// ============================================================
function bundleCardHtml(bundle: AssignmentBundle, projectId: string): string {
  const pct = bundle.progress;
  const statusLabel = BUNDLE_STATUS_LABEL[bundle.status] ?? bundle.status;
  const statusCls = bundleStatusCls(bundle.status);
  const statusColor = bundleStatusColor(bundle.status);
  const tasks = bundle.tasks || [];
  const tasksDone = tasks.filter((t) => t.status === 'completed').length;
  const hasBlockReason = bundle.status === 'blocked' && bundle.blockReason;

  return `
    <div class="bundle-card book-spine ${statusCls}" id="bundle-${bundle.id}">
      <div class="bundle-header" onclick="window.toggleBundle('${bundle.id}')">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="font-mono text-xs font-bold text-accent">${escapeHtml(bundle.code)}</span>
            <span class="status-text ${statusCls}"><span class="dot"></span>${escapeHtml(statusLabel)}</span>
            <span class="badge" style="background:var(--accent-soft);color:var(--accent)">${escapeHtml(bundle.department)}</span>
            ${collabBadgesHtml(bundle.collaboratingDepts || [])}
            ${hasBlockReason ? `<span class="badge badge-overdue">⛔ ${escapeHtml(bundle.blockReason!)}</span>` : ''}
          </div>
          <p class="font-medium text-t1 truncate">${escapeHtml(bundle.name)}</p>
          <div class="flex flex-wrap gap-3 mt-1 text-xs text-t2">
            <span>👤 ${escapeHtml(bundle.ownerName || bundle.ownerId)}</span>
            <span>📅 ${formatDate(bundle.startDate)} → ${formatDate(bundle.dueDate)}</span>
            ${tasks.length > 0 ? `<span>📋 ${tasksDone}/${tasks.length} đầu việc xong</span>` : ''}
            ${bundle.budget ? `<span>💰 ${formatCurrency(bundle.budget)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <div class="flex flex-col items-end gap-1">
            ${progressCellsHtml(pct, progressColor(pct))}
            <span class="font-mono text-xs font-bold" style="color:${progressColor(pct)}">${pct}%</span>
          </div>
          <i data-lucide="chevron-down" class="w-4 h-4 text-t3 bundle-chevron" id="chevron-${bundle.id}"></i>
        </div>
      </div>

      <div class="bundle-tasks" id="bundle-tasks-${bundle.id}" style="display:none">
        ${tasks.length > 0
          ? tasks.map((t) => taskRowHtml(t, bundle.id)).join('')
          : `<div class="bundle-task-row text-xs text-t3 italic py-2">Chưa có đầu việc nào trong hạng mục này.</div>`}
        <div class="flex gap-2 mt-2 pt-2 border-t border-bd-soft">
          <button onclick="window.openBundleDetail('${bundle.id}')" class="btn btn-ghost btn-sm flex-1">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Xem chi tiết
          </button>
        </div>
      </div>
    </div>`;
}

// ============================================================
// Phase section (Giai đoạn)
// ============================================================
function phaseSectionHtml(phase: ProjectPhase, projectId: string): string {
  const bundles = phase.bundles || [];
  const statusLabel = PHASE_STATUS_LABEL[phase.status] ?? phase.status;
  const statusCls = phaseStatusCls(phase.status);
  const totalBundles = bundles.length;
  const doneBundles = bundles.filter((b) => b.status === 'completed' || b.status === 'closed').length;

  return `
    <div class="phase-section" id="phase-${phase.id}">
      <div class="phase-header" onclick="window.togglePhase('${phase.id}')">
        <div class="phase-seq">${phase.sequence}</div>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-t1">${escapeHtml(phase.name)}</span>
            <span class="status-text ${statusCls} text-xs"><span class="dot" style="width:7px;height:7px;"></span>${escapeHtml(statusLabel)}</span>
            ${totalBundles > 0 ? `<span class="text-xs text-t3">${doneBundles}/${totalBundles} hạng mục xong</span>` : ''}
          </div>
          <p class="text-xs text-t2 mt-0.5 font-mono">
            ${formatDate(phase.targetStart)} → ${formatDate(phase.targetEnd)}
            ${phase.actualEnd ? ` · Thực tế: ${formatDate(phase.actualEnd)}` : ''}
          </p>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-t3 phase-chevron" id="phase-chevron-${phase.id}"></i>
      </div>
      <div class="phase-bundles" id="phase-bundles-${phase.id}" style="display:none">
        ${bundles.length > 0
          ? bundles.map((b) => bundleCardHtml(b, projectId)).join('')
          : `<div class="text-sm text-t3 py-3 px-4 italic">Giai đoạn này chưa có hạng mục giao nào.</div>`}
      </div>
    </div>`;
}

// ============================================================
// Project card (Dự án)
// ============================================================
function projectCardHtml(project: ConstructionProject): string {
  const phases = project.phases || [];
  const pct = computeProjectProgress(project);
  const statusLabel = CONSTRUCTION_STATUS_LABEL[project.status] ?? project.status;
  const statusCls = constructionStatusCls(project.status);
  const totalBundles = phases.reduce((acc, ph) => acc + (ph.bundles?.length || 0), 0);
  const doneBundles = phases.reduce((acc, ph) =>
    acc + (ph.bundles || []).filter((b) => b.status === 'completed' || b.status === 'closed').length, 0);
  const isInProgress = project.status === 'in_progress';
  const currentPhase = phases.find((ph) => ph.status === 'in_progress');

  return `
    <div class="construction-project-card" id="cp-${project.id}">
      <!-- Project header -->
      <div class="cp-header" onclick="window.toggleConstructionProject('${project.id}')">
        <div class="cp-left">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="cp-code font-mono">${escapeHtml(project.code)}</span>
            <span class="status-text ${statusCls}"><span class="dot"></span>${escapeHtml(statusLabel)}</span>
            ${project.budget ? `<span class="badge" style="background:var(--success-soft);color:var(--success)">💰 ${formatCurrency(project.budget)}</span>` : ''}
          </div>
          <h3 class="cp-name">${escapeHtml(project.name)}</h3>
          <div class="cp-meta">
            ${project.address ? `<span>📍 ${escapeHtml(project.address)}</span>` : ''}
            ${project.projectManager ? `<span>👔 PM: ${escapeHtml(project.projectManager)}</span>` : ''}
            <span>📅 ${formatDate(project.targetStart)} → ${formatDate(project.targetEnd)}</span>
            ${totalBundles > 0 ? `<span>📦 ${doneBundles}/${totalBundles} hạng mục</span>` : ''}
            ${currentPhase ? `<span class="text-accent">🔄 ${escapeHtml(currentPhase.name)}</span>` : ''}
          </div>
        </div>
        <div class="cp-right">
          <div class="flex flex-col items-end gap-1 mb-2">
            ${progressCellsHtml(pct, progressColor(pct))}
            <span class="font-mono text-xs font-bold" style="color:${progressColor(pct)}">${pct}%</span>
          </div>
          <i data-lucide="chevron-down" class="w-5 h-5 text-t3 cp-chevron" id="cp-chevron-${project.id}"></i>
        </div>
      </div>

      <!-- Phase accordion -->
      <div class="cp-phases" id="cp-phases-${project.id}" style="display:none">
        ${phases.length > 0
          ? phases.map((ph) => phaseSectionHtml(ph, project.id)).join('')
          : `<div class="text-sm text-t3 py-4 px-5 italic">Dự án chưa có giai đoạn nào.</div>`}
      </div>
    </div>`;
}

// ============================================================
// Main render function
// ============================================================
export function renderConstructionProjects(): void {
  const container = document.getElementById('constructionProjectsList');
  const emptyEl = document.getElementById('emptyConstructionProjects');
  if (!container) return;

  const projects = state.constructionProjects;

  if (!projects.length) {
    container.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    refreshIcons();
    return;
  }

  emptyEl?.classList.add('hidden');
  container.innerHTML = projects.map(projectCardHtml).join('');
  refreshIcons();
}

// ============================================================
// Toggle handlers (exposed to window)
// ============================================================

/** Toggle hiển thị phases của 1 dự án */
export function toggleConstructionProject(projectId: string): void {
  const phasesEl = document.getElementById(`cp-phases-${projectId}`);
  const chevronEl = document.getElementById(`cp-chevron-${projectId}`);
  if (!phasesEl || !chevronEl) return;

  const isOpen = phasesEl.style.display !== 'none';
  phasesEl.style.display = isOpen ? 'none' : 'block';
  chevronEl.style.transform = isOpen ? '' : 'rotate(180deg)';
}

/** Toggle hiển thị bundles của 1 giai đoạn */
export function togglePhase(phaseId: string): void {
  const bundlesEl = document.getElementById(`phase-bundles-${phaseId}`);
  const chevronEl = document.getElementById(`phase-chevron-${phaseId}`);
  if (!bundlesEl || !chevronEl) return;

  const isOpen = bundlesEl.style.display !== 'none';
  bundlesEl.style.display = isOpen ? 'none' : 'block';
  chevronEl.style.transform = isOpen ? '' : 'rotate(90deg)';
  refreshIcons();
}

/** Toggle hiển thị tasks của 1 bundle */
export function toggleBundle(bundleId: string): void {
  const tasksEl = document.getElementById(`bundle-tasks-${bundleId}`);
  const chevronEl = document.getElementById(`chevron-${bundleId}`);
  if (!tasksEl || !chevronEl) return;

  const isOpen = tasksEl.style.display !== 'none';
  tasksEl.style.display = isOpen ? 'none' : 'block';
  chevronEl.style.transform = isOpen ? '' : 'rotate(180deg)';
  refreshIcons();
}

/** Mở modal chi tiết bundle (dùng openDetailModal cũ nếu có) */
export function openBundleDetail(bundleId: string): void {
  // Tìm trong state.projects (legacy)
  const legacy = state.projects.find((p) => p.id === bundleId);
  if (legacy && window.openDetailModal) {
    window.openDetailModal(bundleId);
  }
}
