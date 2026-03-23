'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextEmpNo() {
  const row = await queryOne("SELECT emp_no FROM employees WHERE emp_no LIKE 'EMP-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.emp_no) return 'EMP-001';
  const num = parseInt(row.emp_no.split('-')[1], 10) + 1;
  return `EMP-${String(num).padStart(3, '0')}`;
}

// ── /api/employees/* ──────────────────────────────────────────────────

// ── Public staff dropdown — any logged-in user can fetch this ─────────────
router.get('/api/employees/staff', requireLogin, async (req, res, next) => {
  try {
    const employees = await query(
      "SELECT id, emp_no, name, designation, department, phone, email FROM employees WHERE status='Active' ORDER BY name"
    );
    res.json({ success: true, employees });
  } catch (err) { next(err); }
});

router.get('/api/employees/list', requireLogin, async (req, res, next) => {
  try {
    const employees = await query('SELECT * FROM employees ORDER BY id');
    res.json({ success: true, employees });
  } catch (err) { next(err); }
});

router.get('/api/employees/get/:id', requireLogin, async (req, res, next) => {
  try {
    const employee = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    res.json({ success: true, employee });
  } catch (err) { next(err); }
});

router.post('/api/employees/add', requireAdmin, async (req, res, next) => {
  try {
    const emp_no = await nextEmpNo();
    const { name, designation, department, phone, email, date_of_join, status = 'Active', salary, notes } = req.body;
    // Ensure salary + notes columns exist (graceful migration)
    await Promise.allSettled([
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT NULL`),
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`),
    ]);
    const rows = await query(
      `INSERT INTO employees (emp_no, name, designation, department, phone, email, date_of_join, status, salary, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [emp_no, name, designation, department, phone, email, date_of_join || null, status, salary || null, notes || null]
    );
    const employee = rows[0];
    await logAudit('Created Employee', 'HR', req.session.user.email, `Employee ${emp_no} — ${name} added`, req.ip);
    await pushNotification('New Employee', 'Employee ' + emp_no + ' — ' + name + ' added', 'success', 'all');
    res.json({ success: true, employee });
  } catch (err) { next(err); }
});

router.post('/api/employees/update/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Employee not found' });
    const m = { ...existing, ...req.body };
    // Ensure salary + notes columns exist (graceful migration)
    await Promise.allSettled([
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT NULL`),
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`),
    ]);
    await query(
      `UPDATE employees SET name=$1, designation=$2, department=$3, phone=$4, email=$5, date_of_join=$6, status=$7, salary=$8, notes=$9 WHERE id=$10`,
      [m.name, m.designation, m.department, m.phone, m.email, m.date_of_join || null, m.status, m.salary || null, m.notes || null, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    await logAudit('Updated Employee', 'HR', req.session.user.email, `Employee ${existing.emp_no} updated`, req.ip);
    res.json({ success: true, employee: updated });
  } catch (err) { next(err); }
});

router.post('/api/employees/delete/:id', requireAdmin, async (req, res, next) => {
  try {
    const employee = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await query('DELETE FROM employees WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Employee', 'HR', req.session.user.email, `Employee ${employee.emp_no} deleted`, req.ip);
    await pushNotification('Employee Deleted', 'Employee ' + employee.emp_no + ' — ' + employee.name + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── /api/hr/* — aliases pointing to the same handlers ──────────────

router.get('/api/hr/staff', requireLogin, async (req, res, next) => {
  try {
    const employees = await query(
      "SELECT id, emp_no, name, designation, department, phone, email FROM employees WHERE status='Active' ORDER BY name"
    );
    res.json({ success: true, employees });
  } catch (err) { next(err); }
});

router.get('/api/hr/list', requireLogin, async (req, res, next) => {
  try {
    const employees = await query('SELECT * FROM employees ORDER BY id');
    res.json({ success: true, employees });
  } catch (err) { next(err); }
});

router.get('/api/hr/get/:id', requireLogin, async (req, res, next) => {
  try {
    const employee = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    res.json({ success: true, employee });
  } catch (err) { next(err); }
});

router.post('/api/hr/add', requireAdmin, async (req, res, next) => {
  try {
    const emp_no = await nextEmpNo();
    const { name, designation, department, phone, email, date_of_join, status = 'Active', salary, notes } = req.body;
    await Promise.allSettled([
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT NULL`),
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`),
    ]);
    const rows = await query(
      `INSERT INTO employees (emp_no, name, designation, department, phone, email, date_of_join, status, salary, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [emp_no, name, designation, department, phone, email, date_of_join || null, status, salary || null, notes || null]
    );
    const employee = rows[0];
    await logAudit('Created Employee', 'HR', req.session.user.email, `Employee ${emp_no} — ${name} added`, req.ip);
    await pushNotification('New Employee', 'Employee ' + emp_no + ' — ' + name + ' added', 'success', 'all');
    res.json({ success: true, employee });
  } catch (err) { next(err); }
});

router.post('/api/hr/update/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Employee not found' });
    const m = { ...existing, ...req.body };
    await Promise.allSettled([
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT NULL`),
      query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`),
    ]);
    await query(
      `UPDATE employees SET name=$1, designation=$2, department=$3, phone=$4, email=$5, date_of_join=$6, status=$7, salary=$8, notes=$9 WHERE id=$10`,
      [m.name, m.designation, m.department, m.phone, m.email, m.date_of_join || null, m.status, m.salary || null, m.notes || null, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    await logAudit('Updated Employee', 'HR', req.session.user.email, `Employee ${existing.emp_no} updated`, req.ip);
    res.json({ success: true, employee: updated });
  } catch (err) { next(err); }
});

router.post('/api/hr/delete/:id', requireAdmin, async (req, res, next) => {
  try {
    const employee = await queryOne('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    await query('DELETE FROM employees WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Employee', 'HR', req.session.user.email, `Employee ${employee.emp_no} deleted`, req.ip);
    await pushNotification('Employee Deleted', 'Employee ' + employee.emp_no + ' — ' + employee.name + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
