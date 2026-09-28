// ============================================================
// UI helpers: toast, modal, DOM shortcuts
// ============================================================
import { lucideRefresh } from './utils';

export type ModalId = 'projectModal' | 'subTaskModal' | 'dailyLogModal' | 'detailModal' | 'userModal';
const MODAL_IDS: readonly ModalId[] = ['projectModal', 'subTaskModal', 'dailyLogModal', 'detailModal', 'userModal'];

let toastTimer: number | null = null;

// --- Toast ---
export function showToast(msg: string, isError: boolean = false): void {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('toast-show');
  toast.style.background = isError ? '#b91c1c' : '#0f172a';

  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('toast-show');
    toastTimer = null;
  }, 2500);
}

// --- Modals ---
export function openModal(id: ModalId): void {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

export function closeModal(id: ModalId): void {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

export function setupModalBackdropClose(): void {
  MODAL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e: MouseEvent) => {
      if (e.target === el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
      }
    });
  });
}

export function setupEscapeClose(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    MODAL_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('hidden');
      el.classList.remove('flex');
    });
  });
}

// --- DOM shortcuts ---
export function refreshIcons(): void {
  lucideRefresh();
}

export function setHTML(id: string, html: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function showElement(id: string): void {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function hideElement(id: string): void {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function clearElement(id: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
}
