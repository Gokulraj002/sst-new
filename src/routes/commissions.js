'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextCommissionNo() {
  const row = await queryOne("SELECT commission_no FROM commissions WHERE commission_no LIKE 'COM-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.commission_no) return 'COM-001';
  const num = parseInt(row.commission_no.split('-')[1], 10) + 1;
  return `COM-${String(num).padStart(3, '0')}`;
}

router.get('/api/commissions/list', requireLogin, async (req, res, next) => {
  try {
    const commissions = await query('SELECT * FROM commissions ORDER BY id DESC');
    res.json({ success: true, commissions });
  } catch (err) { next(err); }
});

router.get('/api/commissions/get/:id', requireLogin, async (req, res, next) => {
  try {
    const commission = await queryOne('SELECT * FROM commissions WHERE id=$1', [req.params.id]);
    if (!commission) return res.status(404).json({ success: false, error: 'Commission not found' });
    res.json({ success: true, commission });
  } catch (err) { next(err); }
});

router.post('/api/commissions/add', requireLogin, async (req, res, next) => {
  try {
    const commission_no = await nextCommissionNo();
    const {
      staff_name, booking_ref, client, booking_amount = 0,
      commission_rate = 5, commission_amount = 0, month, status = 'Pending', paid_date,
    } = req.body;
    const rows = await query(
      `INSERT INTO commissions
        (commission_no, staff_name, booking_ref, client, booking_amount, commission_rate, commission_amount, month, status, paid_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [commission_no, staff_name, booking_ref, client, booking_amount, commission_rate, commission_amount, month, status, paid_date]
    );
    const commission = rows[0];
    await logAudit('Created Commission', 'Commissions', req.session.user.email, `Commission ${commission_no} for ${staff_name}`, req.ip);
    await pushNotification('Commission Created', `Commission ${commission_no} for ${staff_name} created`, 'info', 'all');
    res.json({ success: true, commission });
  } catch (err) { next(err); }
});

router.post('/api/commissions/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM commissions WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Commission not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE commissions SET staff_name=$1, booking_ref=$2, client=$3, booking_amount=$4, commission_rate=$5,
       commission_amount=$6, month=$7, status=$8, paid_date=$9 WHERE id=$10`,
      [m.staff_name, m.booking_ref, m.client, m.booking_amount, m.commission_rate,
       m.commission_amount, m.month, m.status, m.paid_date, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM commissions WHERE id=$1', [req.params.id]);
    await logAudit('Updated Commission', 'Commissions', req.session.user.email, `Commission ${existing.commission_no} updated`, req.ip);
    res.json({ success: true, commission: updated });
  } catch (err) { next(err); }
});

router.post('/api/commissions/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const commission = await queryOne('SELECT * FROM commissions WHERE id=$1', [req.params.id]);
    if (!commission) return res.status(404).json({ success: false, error: 'Commission not found' });
    await query('DELETE FROM commissions WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Commission', 'Commissions', req.session.user.email, `Commission ${commission.commission_no} deleted`, req.ip);
    await pushNotification('Commission Deleted', `Commission ${commission.commission_no} deleted`, 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
