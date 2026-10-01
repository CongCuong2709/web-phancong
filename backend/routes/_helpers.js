// ============================================================
// routes/_helpers.js — Helper functions cho project/bundle routes
// ============================================================
const db = require('../db');

/** Lấy danh sách phòng ban của user (ưu tiên departments[]) */
function getUserDepartments(userId) {
  const rows = db.prepare(`
    SELECT department FROM user_departments WHERE user_id = ? ORDER BY is_primary DESC
  `).all(userId);
  return rows.map((r) => r.department);
}

/** Lấy 1 user theo id (id, username, fullname, role, department) */
function getUserBrief(id) {
  if (!id) return null;
  return db.prepare(`
    SELECT id, username, fullname, role, department FROM users WHERE id = ? AND active = 1
  `).get(id) || null;
}

/**
 * Tìm Trưởng phòng duy nhất của 1 phòng ban.
 * Trả về null nếu phòng đó chưa có TP active.
 */
function findManagerOfDepartment(department) {
  return db.prepare(`
    SELECT id, fullname FROM users u
    INNER JOIN user_departments ud ON ud.user_id = u.id
    WHERE ud.department = ? AND u.role = 'manager' AND u.active = 1
    ORDER BY ud.is_primary DESC
    LIMIT 1
  `).get(department);
}

/** Parse JSON array từ string, fallback [] */
function parseJsonArray(value, fallback = []) {
  if (!value) return fallback;
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : fallback;
  } catch {
    return fallback;
  }
}

/** Check role: BGĐ và Admin xem được tất cả project */
function canViewAllProjects(user) {
  return user.role === 'admin' || user.role === 'director';
}

/**
 * Lấy danh sách project mà user có quyền xem.
 * - Admin/BGĐ: tất cả
 * - Manager: project có bundle thuộc phòng mình (phòng mình có liên quan)
 * - Employee: project có task giao cho mình
 */
function getVisibleProjects(user) {
  if (user.role === 'admin' || user.role === 'director') {
    return db.prepare('SELECT * FROM construction_projects ORDER BY created_at DESC').all();
  }
  if (user.role === 'manager') {
    const userDepts = getUserDepartments(user.id);
    if (!userDepts.length) return [];
    const placeholders = userDepts.map(() => '?').join(',');
    return db.prepare(`
      SELECT DISTINCT p.* FROM construction_projects p
      INNER JOIN assignment_bundles b ON b.project_id = p.id
      WHERE b.department IN (${placeholders})
      ORDER BY p.created_at DESC
    `).all(...userDepts);
  }
  // employee
  return db.prepare(`
    SELECT DISTINCT p.* FROM construction_projects p
    INNER JOIN tasks t ON t.project_id = p.id
    WHERE t.assignee_id = ?
    ORDER BY p.created_at DESC
  `).all(user.id);
}

/** Check user có quyền edit project (chỉ BGĐ/Admin) */
function canEditProject(user) {
  return user.role === 'admin' || user.role === 'director';
}

/**
 * Check user có quyền edit bundle.
 * - Admin/BGĐ: tất cả
 * - Manager: chỉ bundle thuộc phòng mình
 * - Employee: không
 */
function canEditBundle(user, bundle) {
  if (!user || !bundle) return false;
  if (user.role === 'admin' || user.role === 'director') return true;
  if (user.role === 'manager') {
    const userDepts = getUserDepartments(user.id);
    return userDepts.includes(bundle.department);
  }
  return false;
}

/** Recalc bundle.progress = avg(tasks.progress) */
function recalcBundleProgress(bundleId) {
  const tasks = db.prepare(`
    SELECT progress FROM tasks WHERE bundle_id = ?
  `).all(bundleId);
  if (!tasks.length) return null;
  const avg = Math.round(tasks.reduce((s, r) => s + (r.progress || 0), 0) / tasks.length);
  db.prepare(`
    UPDATE assignment_bundles SET progress = ?, updated_at = ? WHERE id = ?
  `).run(avg, new Date().toISOString(), bundleId);
  return avg;
}

/** Ghi history */
function logHistory(entityType, entityId, action, user) {
  db.prepare(`
    INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    require('crypto').randomUUID(),
    entityType,
    entityId,
    action,
    user.id,
    user.fullname || '',
    new Date().toISOString(),
  );
}

/** Serialize construction_projects row + aggregates */
function serializeProject(p) {
  if (!p) return null;
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT ph.id) AS total_phases,
      COUNT(DISTINCT b.id) AS total_bundles,
      AVG(b.progress) AS overall_progress
    FROM construction_projects p
    LEFT JOIN project_phases ph ON ph.project_id = p.id
    LEFT JOIN assignment_bundles b ON b.project_id = p.id
    WHERE p.id = ?
  `).get(p.id);
  const manager = getUserBrief(p.project_manager_id);
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    address: p.address,
    projectManagerId: p.project_manager_id,
    projectManager: manager,
    targetStart: p.target_start,
    targetEnd: p.target_end,
    actualEnd: p.actual_end,
    status: p.status,
    budget: p.budget,
    createdBy: p.created_by,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    stats: {
      totalPhases: stats?.total_phases || 0,
      totalBundles: stats?.total_bundles || 0,
      overallProgress: stats?.overall_progress ? Math.round(stats.overall_progress) : 0,
    },
  };
}

function serializePhase(ph) {
  if (!ph) return null;
  const bundleCount = db.prepare(`
    SELECT COUNT(*) as c FROM assignment_bundles WHERE phase_id = ?
  `).get(ph.id).c;
  return {
    id: ph.id,
    projectId: ph.project_id,
    name: ph.name,
    sequence: ph.sequence,
    description: ph.description,
    targetStart: ph.target_start,
    targetEnd: ph.target_end,
    actualStart: ph.actual_start,
    actualEnd: ph.actual_end,
    status: ph.status,
    bundleCount,
  };
}

function serializeBundle(b) {
  if (!b) return null;
  const owner = getUserBrief(b.owner_id);
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    description: b.description,
    projectId: b.project_id,
    phaseId: b.phase_id,
    ownerId: b.owner_id,
    owner,
    department: b.department,
    startDate: b.start_date,
    dueDate: b.due_date,
    status: b.status,
    progress: b.progress,
    priority: b.priority,
    notes: b.notes,
    tags: parseJsonArray(b.tags),
    budget: b.budget,
    collaboratingDepts: parseJsonArray(b.collaborating_depts),
    blockReason: b.block_reason,
    createdBy: b.created_by,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

module.exports = {
  getUserDepartments,
  getUserBrief,
  findManagerOfDepartment,
  parseJsonArray,
  canViewAllProjects,
  getVisibleProjects,
  canEditProject,
  canEditBundle,
  recalcBundleProgress,
  logHistory,
  serializeProject,
  serializePhase,
  serializeBundle,
};
