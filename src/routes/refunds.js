'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextRefundNo() {
  const row = await queryOne("SELECT refund_no FROM refunds WHERE refund_no LIKE 'RFD-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.refund_no) return 'RFD-001';
  const num = parseInt(row.refund_no.split('-')[1], 10) + 1;
  return `RFD-${String(num).padStart(3, '0')}`;
}

router.get('/api/refunds/list', requireLogin, async (req, res, next) => {
  try {
    const refunds = await query('SELECT * FROM refunds ORDER BY id DESC');
    res.json({ success: true, refunds });
  } catch (err) { next(err); }
});

router.get('/api/refunds/get/:id', requireLogin, async (req, res, next) => {
  try {
    const refund = await queryOne('SELECT * FROM refunds WHERE id=$1', [req.params.id]);
    if (!refund) return res.status(404).json({ success: false, error: 'Refund not found' });
    res.json({ success: true, refund });
  } catch (err) { next(err); }
});

router.post('/api/refunds/add', requireLogin, async (req, res, next) => {
  try {
    const refund_no = await nextRefundNo();
    const {
      client, booking_ref, original_amount = 0, refund_amount = 0,
      reason, refund_mode = 'NEFT', refund_date, processed_by, status = 'Pending', notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO refunds
        (refund_no, client, booking_ref, original_amount, refund_amount, reason, refund_mode, refund_date, processed_by, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [refund_no, client, booking_ref, original_amount, refund_amount, reason, refund_mode, refund_date, processed_by, status, notes]
    );
    const refund = rows[0];
    await logAudit('Created Refund', 'Refunds', req.session.user.email, `Refund ${refund_no} for ${client}`, req.ip);
    await pushNotification('Refund Created', 'Refund ' + refund_no + ' for ' + client + ' created', 'info', 'all');
    res.json({ success: true, refund });
  } catch (err) { next(err); }
});

router.post('/api/refunds/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM refunds WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Refund not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE refunds SET client=$1, booking_ref=$2, original_amount=$3, refund_amount=$4, reason=$5,
       refund_mode=$6, refund_date=$7, processed_by=$8, status=$9, notes=$10 WHERE id=$11`,
      [m.client, m.booking_ref, m.original_amount, m.refund_amount, m.reason,
       m.refund_mode, m.refund_date, m.processed_by, m.status, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM refunds WHERE id=$1', [req.params.id]);
    await logAudit('Updated Refund', 'Refunds', req.session.user.email, `Refund ${existing.refund_no} updated`, req.ip);
    res.json({ success: true, refund: updated });
  } catch (err) { next(err); }
});

router.post('/api/refunds/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const refund = await queryOne('SELECT * FROM refunds WHERE id=$1', [req.params.id]);
    if (!refund) return res.status(404).json({ success: false, error: 'Refund not found' });
    await query('DELETE FROM refunds WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Refund', 'Refunds', req.session.user.email, `Refund ${refund.refund_no} deleted`, req.ip);
    await pushNotification('Refund Deleted', 'Refund ' + refund.refund_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
