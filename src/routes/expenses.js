'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextExpenseNo() {
  const row = await queryOne("SELECT expense_no FROM expenses WHERE expense_no LIKE 'EXP-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.expense_no) return 'EXP-001';
  const num = parseInt(row.expense_no.split('-')[1], 10) + 1;
  return `EXP-${String(num).padStart(3, '0')}`;
}

router.get('/api/expenses/list', requireLogin, async (req, res, next) => {
  try {
    const expenses = await query('SELECT * FROM expenses ORDER BY id DESC');
    res.json({ success: true, expenses });
  } catch (err) { next(err); }
});

router.get('/api/expenses/get/:id', requireLogin, async (req, res, next) => {
  try {
    const expense = await queryOne('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true, expense });
  } catch (err) { next(err); }
});

router.post('/api/expenses/add', requireLogin, async (req, res, next) => {
  try {
    const expense_no = await nextExpenseNo();
    const {
      category = 'Office', description, amount = 0,
      paid_by, payment_mode = 'Cash', expense_date,
      receipt, status = 'Pending', approved_by, notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO expenses
        (expense_no, category, description, amount, paid_by, payment_mode, expense_date, receipt, status, approved_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [expense_no, category, description, amount, paid_by, payment_mode, expense_date, receipt, status, approved_by, notes]
    );
    const expense = rows[0];
    await logAudit('Created Expense', 'Expenses', req.session.user.email, `Expense ${expense_no}: ${description}`, req.ip);
    await pushNotification('Expense Added', 'Expense ' + expense_no + ' — ' + description + ' added', 'info', 'all');
    if (status === 'Pending') {
      await pushNotification('Expense Pending Approval', `Expense ${expense_no} by ${paid_by} needs approval`, 'warning', 'admin');
    }
    res.json({ success: true, expense });
  } catch (err) { next(err); }
});

router.post('/api/expenses/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Expense not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, paid_by=$4, payment_mode=$5,
       expense_date=$6, receipt=$7, status=$8, approved_by=$9, notes=$10 WHERE id=$11`,
      [m.category, m.description, m.amount, m.paid_by, m.payment_mode,
       m.expense_date, m.receipt, m.status, m.approved_by, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    await logAudit('Updated Expense', 'Expenses', req.session.user.email, `Expense ${existing.expense_no} updated`, req.ip);
    res.json({ success: true, expense: updated });
  } catch (err) { next(err); }
});

router.post('/api/expenses/approve/:id', requireLogin, async (req, res, next) => {
  try {
    const expense = await queryOne('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    const approver = req.session.user.name || req.session.user.email;
    await query('UPDATE expenses SET status=$1, approved_by=$2 WHERE id=$3', ['Approved', approver, req.params.id]);
    await logAudit('Approved Expense', 'Expenses', req.session.user.email, `Expense ${expense.expense_no} approved`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/api/expenses/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const expense = await queryOne('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    await query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Expense', 'Expenses', req.session.user.email, `Expense ${expense.expense_no} deleted`, req.ip);
    await pushNotification('Expense Deleted', 'Expense ' + expense.expense_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
