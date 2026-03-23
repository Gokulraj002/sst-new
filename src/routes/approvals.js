'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextApprovalNo() {
  const row = await queryOne("SELECT approval_no FROM approvals WHERE approval_no LIKE 'APR-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.approval_no) return 'APR-001';
  const num = parseInt(row.approval_no.split('-')[1], 10) + 1;
  return `APR-${String(num).padStart(3, '0')}`;
}

router.get('/api/approvals/list', requireLogin, async (req, res, next) => {
  try {
    const approvals = await query('SELECT * FROM approvals ORDER BY id DESC');
    res.json({ success: true, approvals });
  } catch (err) { next(err); }
});

router.get('/api/approvals/get/:id', requireLogin, async (req, res, next) => {
  try {
    const approval = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    res.json({ success: true, approval });
  } catch (err) { next(err); }
});

router.post('/api/approvals/add', requireLogin, async (req, res, next) => {
  try {
    const approval_no = await nextApprovalNo();
    const {
      request_type = 'Expense', requested_by, description, amount = 0,
      request_date, status = 'Pending', approved_by, approved_date, remarks,
    } = req.body;
    const rows = await query(
      `INSERT INTO approvals
        (approval_no, request_type, requested_by, description, amount, request_date, status, approved_by, approved_date, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [approval_no, request_type, requested_by, description, amount, request_date, status, approved_by, approved_date, remarks]
    );
    const approval = rows[0];
    await logAudit('Created Approval Request', 'Approvals', req.session.user.email, `Approval ${approval_no} by ${requested_by}`, req.ip);
    await pushNotification('New Approval Request', `${request_type} request from ${requested_by} needs approval`, 'warning', 'admin');
    res.json({ success: true, approval });
  } catch (err) { next(err); }
});

router.post('/api/approvals/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Approval not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE approvals SET request_type=$1, requested_by=$2, description=$3, amount=$4,
       request_date=$5, status=$6, approved_by=$7, approved_date=$8, remarks=$9 WHERE id=$10`,
      [m.request_type, m.requested_by, m.description, m.amount,
       m.request_date, m.status, m.approved_by, m.approved_date, m.remarks, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    await logAudit('Updated Approval', 'Approvals', req.session.user.email, `Approval ${existing.approval_no} updated`, req.ip);
    res.json({ success: true, approval: updated });
  } catch (err) { next(err); }
});

// POST /api/approvals/action/:id  — generic action (approve/reject via body.action)
router.post('/api/approvals/action/:id', requireLogin, async (req, res, next) => {
  try {
    const { action, remarks } = req.body; // action: 'approve' | 'reject'
    const approval = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
    const approver = req.session.user.name || req.session.user.email;
    const today = new Date().toISOString().split('T')[0];
    await query(
      'UPDATE approvals SET status=$1, approved_by=$2, approved_date=$3, remarks=$4 WHERE id=$5',
      [newStatus, approver, today, remarks || approval.remarks, req.params.id]
    );
    await logAudit(`${newStatus} Approval`, 'Approvals', req.session.user.email, `Approval ${approval.approval_no} ${newStatus.toLowerCase()}`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/approvals/approve/:id
router.post('/api/approvals/approve/:id', requireLogin, async (req, res, next) => {
  try {
    const approval = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    const approver = req.session.user.name || req.session.user.email;
    const today = new Date().toISOString().split('T')[0];
    await query(
      'UPDATE approvals SET status=$1, approved_by=$2, approved_date=$3 WHERE id=$4',
      ['Approved', approver, today, req.params.id]
    );
    await logAudit('Approved Approval', 'Approvals', req.session.user.email, `Approval ${approval.approval_no} approved`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/approvals/reject/:id
router.post('/api/approvals/reject/:id', requireLogin, async (req, res, next) => {
  try {
    const approval = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    const approver = req.session.user.name || req.session.user.email;
    const today = new Date().toISOString().split('T')[0];
    const { remarks } = req.body;
    await query(
      'UPDATE approvals SET status=$1, approved_by=$2, approved_date=$3, remarks=$4 WHERE id=$5',
      ['Rejected', approver, today, remarks || null, req.params.id]
    );
    await logAudit('Rejected Approval', 'Approvals', req.session.user.email, `Approval ${approval.approval_no} rejected`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/api/approvals/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const approval = await queryOne('SELECT * FROM approvals WHERE id=$1', [req.params.id]);
    if (!approval) return res.status(404).json({ success: false, error: 'Approval not found' });
    await query('DELETE FROM approvals WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Approval', 'Approvals', req.session.user.email, `Approval ${approval.approval_no} deleted`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
