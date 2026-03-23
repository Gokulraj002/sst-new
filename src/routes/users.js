'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { hashPassword, verifyPassword } = require('../utils/passwordHelper');
const { logAudit } = require('../utils/auditLogger');

// ── Role presets — default permissions for each role ──────────────────────────
const ALL_ACTIONS = { view: true, create: true, edit: true, delete: true };
const VIEW_ONLY   = { view: true, create: false, edit: false, delete: false };
const NONE        = { view: false, create: false, edit: false, delete: false };

const ROLE_PRESETS = {
  admin: {
    dashboard: ALL_ACTIONS, notifications: ALL_ACTIONS,
    leads: ALL_ACTIONS, quotations: ALL_ACTIONS, bookings: ALL_ACTIONS,
    operations: ALL_ACTIONS, itinerary: ALL_ACTIONS, visa: ALL_ACTIONS,
    inventory: ALL_ACTIONS, documents: ALL_ACTIONS,
    finance: ALL_ACTIONS, pnl: ALL_ACTIONS, vendorpay: ALL_ACTIONS,
    expenses: ALL_ACTIONS, vouchers: ALL_ACTIONS, refunds: ALL_ACTIONS,
    hr: ALL_ACTIONS, customers: ALL_ACTIONS, suppliers: ALL_ACTIONS,
    commissions: ALL_ACTIONS, approvals: ALL_ACTIONS, reports: ALL_ACTIONS,
    audit: ALL_ACTIONS, iam: ALL_ACTIONS, settings: ALL_ACTIONS,
  },
  sales_manager: {
    dashboard: VIEW_ONLY, notifications: ALL_ACTIONS,
    leads: ALL_ACTIONS, quotations: ALL_ACTIONS, bookings: ALL_ACTIONS,
    operations: VIEW_ONLY, itinerary: VIEW_ONLY, visa: VIEW_ONLY,
    inventory: VIEW_ONLY, documents: VIEW_ONLY,
    finance: VIEW_ONLY, pnl: VIEW_ONLY, vendorpay: NONE,
    expenses: VIEW_ONLY, vouchers: NONE, refunds: VIEW_ONLY,
    hr: NONE, customers: ALL_ACTIONS, suppliers: VIEW_ONLY,
    commissions: ALL_ACTIONS, approvals: { view: true, create: true, edit: false, delete: false },
    reports: VIEW_ONLY, audit: NONE, iam: NONE, settings: NONE,
  },
  operations_manager: {
    dashboard: VIEW_ONLY, notifications: ALL_ACTIONS,
    leads: VIEW_ONLY, quotations: VIEW_ONLY, bookings: { view: true, create: false, edit: true, delete: false },
    operations: ALL_ACTIONS, itinerary: ALL_ACTIONS, visa: ALL_ACTIONS,
    inventory: ALL_ACTIONS, documents: ALL_ACTIONS,
    finance: VIEW_ONLY, pnl: NONE, vendorpay: VIEW_ONLY,
    expenses: VIEW_ONLY, vouchers: NONE, refunds: VIEW_ONLY,
    hr: VIEW_ONLY, customers: VIEW_ONLY, suppliers: ALL_ACTIONS,
    commissions: NONE, approvals: { view: true, create: true, edit: false, delete: false },
    reports: VIEW_ONLY, audit: NONE, iam: NONE, settings: NONE,
  },
  finance_manager: {
    dashboard: VIEW_ONLY, notifications: ALL_ACTIONS,
    leads: VIEW_ONLY, quotations: VIEW_ONLY, bookings: VIEW_ONLY,
    operations: NONE, itinerary: NONE, visa: NONE,
    inventory: NONE, documents: VIEW_ONLY,
    finance: ALL_ACTIONS, pnl: ALL_ACTIONS, vendorpay: ALL_ACTIONS,
    expenses: ALL_ACTIONS, vouchers: ALL_ACTIONS, refunds: ALL_ACTIONS,
    hr: VIEW_ONLY, customers: VIEW_ONLY, suppliers: VIEW_ONLY,
    commissions: ALL_ACTIONS, approvals: ALL_ACTIONS,
    reports: ALL_ACTIONS, audit: VIEW_ONLY, iam: NONE, settings: NONE,
  },
  hr_manager: {
    dashboard: VIEW_ONLY, notifications: ALL_ACTIONS,
    leads: VIEW_ONLY, quotations: NONE, bookings: VIEW_ONLY,
    operations: NONE, itinerary: NONE, visa: NONE,
    inventory: NONE, documents: VIEW_ONLY,
    finance: NONE, pnl: NONE, vendorpay: NONE,
    expenses: ALL_ACTIONS, vouchers: NONE, refunds: NONE,
    hr: ALL_ACTIONS, customers: ALL_ACTIONS, suppliers: VIEW_ONLY,
    commissions: VIEW_ONLY, approvals: { view: true, create: true, edit: false, delete: false },
    reports: VIEW_ONLY, audit: NONE, iam: NONE, settings: NONE,
  },
  staff: {
    dashboard: VIEW_ONLY, notifications: VIEW_ONLY,
    leads: { view: true, create: true, edit: true, delete: false },
    quotations: VIEW_ONLY, bookings: VIEW_ONLY,
    operations: { view: true, create: true, edit: true, delete: false },
    itinerary: VIEW_ONLY, visa: VIEW_ONLY,
    inventory: VIEW_ONLY, documents: VIEW_ONLY,
    finance: NONE, pnl: NONE, vendorpay: NONE,
    expenses: { view: true, create: true, edit: false, delete: false },
    vouchers: NONE, refunds: NONE,
    hr: NONE, customers: VIEW_ONLY, suppliers: NONE,
    commissions: NONE, approvals: VIEW_ONLY,
    reports: NONE, audit: NONE, iam: NONE, settings: NONE,
  },
};

// ── Helper: ensure permissions always has data ────────────────────────────────
function resolvePermissions(user) {
  const perms = user.permissions;
  // If null, empty object, or missing keys — fall back to role preset
  if (!perms || Object.keys(perms).length === 0) {
    return ROLE_PRESETS[user.role] || ROLE_PRESETS.staff;
  }
  return perms;
}

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/api/users/list', requireAdmin, async (req, res, next) => {
  try {
    const users = await query(
      'SELECT id, name, email, role, department, last_login, status, permissions, created_at FROM users ORDER BY id'
    );
    const resolved = users.map((u) => ({ ...u, permissions: resolvePermissions(u) }));
    res.json({ success: true, users: resolved });
  } catch (err) { next(err); }
});

// ── Get one ───────────────────────────────────────────────────────────────────
router.get('/api/users/get/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await queryOne(
      'SELECT id, name, email, role, department, last_login, status, permissions, created_at FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.permissions = resolvePermissions(user);
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// ── Get role preset ───────────────────────────────────────────────────────────
router.get('/api/users/role-preset/:role', requireAdmin, (req, res) => {
  const preset = ROLE_PRESETS[req.params.role];
  if (!preset) return res.status(404).json({ success: false, error: 'Unknown role' });
  res.json({ success: true, permissions: preset });
});

// ── Add ───────────────────────────────────────────────────────────────────────
router.post('/api/users/add', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role = 'staff', department = 'Sales', status = 'active', permissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email and password are required' });
    }
    const existing = await queryOne('SELECT id FROM users WHERE email=$1', [email]);
    if (existing) return res.status(409).json({ success: false, error: 'Email already exists' });
    const hashed = await hashPassword(password);
    // Use role preset if no explicit permissions provided
    const perms = permissions || ROLE_PRESETS[role] || ROLE_PRESETS.staff;
    const rows = await query(
      `INSERT INTO users (name, email, password, role, department, status, permissions)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, role, department, status, permissions, created_at`,
      [name, email, hashed, role, department, status, JSON.stringify(perms)]
    );
    const user = rows[0];
    await logAudit('Created User', 'Users', req.session.user.email, `User ${email} (${role}) created`, req.ip);
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// ── Update ────────────────────────────────────────────────────────────────────
router.post('/api/users/update/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'User not found' });
    const m = { ...existing, ...req.body };
    const perms = req.body.permissions || existing.permissions || ROLE_PRESETS[m.role] || ROLE_PRESETS.staff;
    await query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4, status=$5, permissions=$6 WHERE id=$7`,
      [m.name, m.email, m.role, m.department, m.status, JSON.stringify(perms), req.params.id]
    );
    const updated = await queryOne(
      'SELECT id, name, email, role, department, last_login, status, permissions, created_at FROM users WHERE id=$1',
      [req.params.id]
    );
    await logAudit('Updated User', 'Users', req.session.user.email, `User ${existing.email} updated`, req.ip);
    res.json({ success: true, user: updated });
  } catch (err) { next(err); }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.post('/api/users/delete/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.id === req.session.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    await query('DELETE FROM users WHERE id=$1', [req.params.id]);
    await logAudit('Deleted User', 'Users', req.session.user.email, `User ${user.email} deleted`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Change password (self) ────────────────────────────────────────────────────
router.post('/api/users/change-password', requireLogin, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'current_password and new_password are required' });
    }
    const user = await queryOne('SELECT * FROM users WHERE id=$1', [req.session.user.id]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const valid = await verifyPassword(current_password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    const hashed = await hashPassword(new_password);
    await query('UPDATE users SET password=$1 WHERE id=$2', [hashed, user.id]);
    await logAudit('Changed Password', 'Users', req.session.user.email, 'Password changed', req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Reset password (admin) ────────────────────────────────────────────────────
router.post('/api/users/reset-password/:id', requireAdmin, async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    const user = await queryOne('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const hashed = await hashPassword(new_password);
    await query('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.params.id]);
    await logAudit('Reset Password', 'Users', req.session.user.email, `Password reset for ${user.email}`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
