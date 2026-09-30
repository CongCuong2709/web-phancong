// ============================================================
// theme.ts — Quản lý theme (light/dark/auto)
// ============================================================
export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'pc-theme';

function getStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore (Safari private mode, etc.) */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

/** Set theme trên <html> ngay lập tức (gọi từ inline script + khi toggle). */
export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
}

/** Public API: đổi theme + lưu vào localStorage + cập nhật UI. */
export function setTheme(mode: ThemeMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  applyTheme(mode);
  // Gọi hook UI để highlight nút toggle
  document.dispatchEvent(new CustomEvent('themechange', { detail: { mode } }));
}

export function getTheme(): ThemeMode {
  return getStored();
}

/** Khởi tạo: lắng nghe prefers-color-scheme nếu đang ở 'system'. */
export function initThemeListener(): void {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (): void => {
    if (getStored() === 'system') applyTheme('system');
  };
  if (mq.addEventListener) mq.addEventListener('change', handler);
  else if ((mq as MediaQueryList).addListener) (mq as MediaQueryList).addListener(handler);
}

/** Render HTML cho 3 nút theme switcher; trả về chuỗi HTML. */
export function themeSwitcherHtml(currentMode: ThemeMode): string {
  return `
    <div class="theme-switcher" role="group" aria-label="Theme">
      <button class="theme-btn ${currentMode === 'light' ? 'active' : ''}"
              data-theme-mode="light" title="Sáng" aria-label="Theme sáng">
        ${sunIcon()}
      </button>
      <button class="theme-btn ${currentMode === 'dark' ? 'active' : ''}"
              data-theme-mode="dark" title="Tối" aria-label="Theme tối">
        ${moonIcon()}
      </button>
      <button class="theme-btn ${currentMode === 'system' ? 'active' : ''}"
              data-theme-mode="system" title="Theo hệ thống" aria-label="Theme theo hệ thống">
        ${autoIcon()}
      </button>
    </div>
  `;
}

/** Gắn event delegation cho 3 nút theme switcher. */
export function bindThemeSwitcher(): void {
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    const btn = t?.closest<HTMLElement>('[data-theme-mode]');
    if (!btn) return;
    const mode = btn.dataset.themeMode as ThemeMode | undefined;
    if (!mode) return;
    setTheme(mode);
    // Cập nhật visual của switcher
    const switcher = btn.closest('.theme-switcher');
    if (switcher) {
      switcher.querySelectorAll<HTMLElement>('.theme-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.themeMode === mode);
      });
    }
  });
}

function sunIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
}
function moonIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}
function autoIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>`;
}
