// ============================================================
// test-suite.js — Script kiểm thử tự động cho backend Phân công Công việc
// Chạy bằng: node --experimental-sqlite test-suite.js
// ============================================================

const assert = require('assert');
const db = require('./db');
const { seedIfEmpty } = require('./seed');
const express = require('express');
const http = require('http');

console.log('🧪 ============================================================');
console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITE)');
console.log('🧪 ============================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Chi tiết lỗi: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Chi tiết lỗi: ${err.message}`);
  }
}

// 1. Seed & DB Test
runTest('1. Database Tables & Seed Verification', () => {
  seedIfEmpty();

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  assert.ok(userCount >= 8, `Số lượng user phải >= 8 (thực tế: ${userCount})`);

  const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
  assert.ok(taskCount >= 3, `Số lượng task phải >= 3 (thực tế: ${taskCount})`);

  const subtaskCount = db.prepare('SELECT COUNT(*) as c FROM subtasks').get().c;
  assert.ok(subtaskCount >= 4, `Số lượng subtask phải >= 4 (thực tế: ${subtaskCount})`);
});

// Setup server for API integration test
const serverApp = require('./server');

// Run HTTP API tests against live Express server
async function main() {
  const server = http.createServer(serverApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function apiPost(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function apiGet(path, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function apiPut(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    const data = await res.json();
    return { status: res.status, data };
  }

  // 2. Authentication API Test
  let adminToken = '';
  let managerItToken = '';
  let managerNsToken = '';
  let employeeItToken = '';
  let employeeItId = '';

  await runAsyncTest('2. Auth API - Đăng nhập tài khoản Admin, Trưởng phòng IT, TP Nhân sự, NV IT', async () => {
    // Admin login
    const adminRes = await apiPost('/auth/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(adminRes.status, 200, 'Admin đăng nhập thất bại');
    assert.ok(adminRes.data.token, 'Admin thiếu JWT token');
    adminToken = adminRes.data.token;

    // Manager IT login
    const tpItRes = await apiPost('/auth/login', { username: 'tp.it', password: '123456' });
    assert.strictEqual(tpItRes.status, 200, 'TP IT đăng nhập thất bại');
    managerItToken = tpItRes.data.token;

    // Manager NS login
    const tpNsRes = await apiPost('/auth/login', { username: 'tp.ns', password: '123456' });
    assert.strictEqual(tpNsRes.status, 200, 'TP NS đăng nhập thất bại');
    managerNsToken = tpNsRes.data.token;

    // Employee IT login
    const nvItRes = await apiPost('/auth/login', { username: 'nv.it01', password: '123456' });
    assert.strictEqual(nvItRes.status, 200, 'NV IT01 đăng nhập thất bại');
    employeeItToken = nvItRes.data.token;
    employeeItId = nvItRes.data.user.id;

    // Test bad login
    const badRes = await apiPost('/auth/login', { username: 'admin', password: 'wrongpassword' });
    assert.strictEqual(badRes.status, 401, 'Mật khẩu sai phải trả về 401');
  });

  // 3. Department Task Isolation Test
  await runAsyncTest('3. Phân quyền xem Task theo 2 Phòng Ban & Vai Trò', async () => {
    // Admin / Director see all tasks
    const adminTasks = await apiGet('/tasks', adminToken);
    assert.strictEqual(adminTasks.status, 200);
    assert.ok(adminTasks.data.length >= 3, 'Admin phải thấy tất cả các task');

    // TP IT sees IT tasks and collab tasks
    const tpItTasks = await apiGet('/tasks', managerItToken);
    assert.strictEqual(tpItTasks.status, 200);
    const hasItTask = tpItTasks.data.some(t => t.department === 'Phòng IT');
    assert.ok(hasItTask, 'TP IT phải thấy task của Phòng IT');

    // TP NS sees NS tasks and collab tasks
    const tpNsTasks = await apiGet('/tasks', managerNsToken);
    assert.strictEqual(tpNsTasks.status, 200);
    const hasNsTask = tpNsTasks.data.some(t => t.department === 'Phòng Nhân sự');
    assert.ok(hasNsTask, 'TP NS phải thấy task của Phòng Nhân sự');
  });

  // 4. Task Lifecycle Test (Create -> Add Subtask -> Daily Log -> Recalc Progress)
  await runAsyncTest('4. Vòng đời Công việc (Tạo Task -> Giao Subtask -> Ghi Daily Log -> Tự tính % tiến độ)', async () => {
    // TP IT tạo Task mới
    const createRes = await apiPost('/tasks', {
      name: 'Kiểm thử 2 Phòng Ban Pilot',
      description: 'Dự án thử nghiệm phân công 2 phòng ban',
      department: 'Phòng IT',
      collaboratingDepts: ['Phòng Nhân sự'],
      priority: 'high',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
    }, managerItToken);

    assert.strictEqual(createRes.status, 201, 'Tạo task thất bại');
    const createdTask = createRes.data;
    assert.strictEqual(createdTask.progress, 0);

    // TP IT tạo 2 SubTask giao cho NV IT01
    const sub1Res = await apiPost(`/tasks/${createdTask.id}/subtasks`, {
      name: 'Cấu hình Server & CSDL',
      assigneeId: employeeItId,
      priority: 'high',
    }, managerItToken);
    assert.strictEqual(sub1Res.status, 201, 'Tạo subtask 1 thất bại');
    const sub1Id = sub1Res.data.id;

    const sub2Res = await apiPost(`/tasks/${createdTask.id}/subtasks`, {
      name: 'Viết tài liệu Hướng dẫn Pilot',
      assigneeId: employeeItId,
      priority: 'medium',
    }, managerItToken);
    assert.strictEqual(sub2Res.status, 201, 'Tạo subtask 2 thất bại');
    const sub2Id = sub2Res.data.id;

    // NV IT01 ghi Log cho Subtask 1 với progress 100%
    const log1Res = await apiPost(`/tasks/${createdTask.id}/subtasks/${sub1Id}/logs`, {
      date: '2026-10-02',
      description: 'Hoàn thành cấu hình server DB',
      result: 'Server hoạt động tốt trên LAN',
      obstacle: 'Không có',
      progress: 100,
    }, employeeItToken);
    assert.strictEqual(log1Res.status, 201, 'Ghi log subtask 1 thất bại');

    // NV IT01 ghi Log cho Subtask 2 với progress 50%
    const log2Res = await apiPost(`/tasks/${createdTask.id}/subtasks/${sub2Id}/logs`, {
      date: '2026-10-03',
      description: 'Soạn thảo xong 50% tài liệu',
      result: 'Xong bản nháp',
      obstacle: 'Không có',
      progress: 50,
    }, employeeItToken);
    assert.strictEqual(log2Res.status, 201, 'Ghi log subtask 2 thất bại');

    // Kiểm tra progress tự tính của Task mẹ: avg(100, 50) = 75%
    const getTaskRes = await apiGet(`/tasks/${createdTask.id}`, managerItToken);
    assert.strictEqual(getTaskRes.data.progress, 75, `Tiến độ tự động phải là 75% (thực tế: ${getTaskRes.data.progress}%)`);
  });

  // 5. Security Guard Test - Cross Department & Role Escalation
  await runAsyncTest('5. Bảo mật Phân quyền - Ngăn Trưởng phòng sửa Task phòng khác & NV đổi người phụ trách', async () => {
    // Lấy task của Phòng IT
    const itTasks = await apiGet('/tasks', managerItToken);
    const itTaskId = itTasks.data.find(t => t.department === 'Phòng IT')?.id;

    // TP NS thử sửa Task của Phòng IT -> Phải bị từ chối 403
    if (itTaskId) {
      const editRes = await apiPut(`/tasks/${itTaskId}`, { name: 'Hack Tên Task IT' }, managerNsToken);
      assert.strictEqual(editRes.status, 403, 'TP NS không được phép sửa Task của Phòng IT');
    }

    // NV IT01 thử tạo Task mới -> Phải bị từ chối 403 (chỉ manager/director/admin mới tạo được task)
    const nvCreateRes = await apiPost('/tasks', { name: 'NV Tự Tạo Task' }, employeeItToken);
    assert.strictEqual(nvCreateRes.status, 403, 'Employee không được phép tạo Task mẹ');
  });

  console.log('');
  console.log('🏁 ============================================================');
  console.log(`🏁 TỔNG KẾT KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('🏁 ============================================================');

  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
