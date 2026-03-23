'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextPaymentNo() {
  const row = await queryOne("SELECT payment_no FROM vendor_payments WHERE payment_no LIKE 'VP-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.payment_no) return 'VP-001';
  const num = parseInt(row.payment_no.split('-')[1], 10) + 1;
  return `VP-${String(num).padStart(3, '0')}`;
}

router.get('/api/vendorpay/list', requireLogin, async (req, res, next) => {
  try {
    const payments = await query('SELECT * FROM vendor_payments ORDER BY id DESC');
    res.json({ success: true, payments });
  } catch (err) { next(err); }
});

router.get('/api/vendorpay/get/:id', requireLogin, async (req, res, next) => {
  try {
    const payment = await queryOne('SELECT * FROM vendor_payments WHERE id=$1', [req.params.id]);
    if (!payment) return res.status(404).json({ success: false, error: 'Vendor payment not found' });
    res.json({ success: true, payment });
  } catch (err) { next(err); }
});

router.post('/api/vendorpay/add', requireLogin, async (req, res, next) => {
  try {
    const payment_no = await nextPaymentNo();
    const {
      vendor_id, vendor_name, booking_ref, amount = 0,
      payment_date, payment_mode = 'NEFT', status = 'Pending', notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO vendor_payments
        (payment_no, vendor_id, vendor_name, booking_ref, amount, payment_date, payment_mode, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [payment_no, vendor_id, vendor_name, booking_ref, amount, payment_date, payment_mode, status, notes]
    );
    const payment = rows[0];
    await logAudit('Created Vendor Payment', 'VendorPay', req.session.user.email, `Payment ${payment_no} to ${vendor_name}`, req.ip);
    await pushNotification('Vendor Payment Created', 'Payment ' + payment_no + ' to ' + vendor_name + ' created', 'info', 'all');
    res.json({ success: true, payment });
  } catch (err) { next(err); }
});

router.post('/api/vendorpay/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM vendor_payments WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Vendor payment not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE vendor_payments SET vendor_id=$1, vendor_name=$2, booking_ref=$3, amount=$4,
       payment_date=$5, payment_mode=$6, status=$7, notes=$8 WHERE id=$9`,
      [m.vendor_id, m.vendor_name, m.booking_ref, m.amount,
       m.payment_date, m.payment_mode, m.status, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM vendor_payments WHERE id=$1', [req.params.id]);
    await logAudit('Updated Vendor Payment', 'VendorPay', req.session.user.email, `Payment ${existing.payment_no} updated`, req.ip);
    res.json({ success: true, payment: updated });
  } catch (err) { next(err); }
});

router.post('/api/vendorpay/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const payment = await queryOne('SELECT * FROM vendor_payments WHERE id=$1', [req.params.id]);
    if (!payment) return res.status(404).json({ success: false, error: 'Vendor payment not found' });
    await query('DELETE FROM vendor_payments WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Vendor Payment', 'VendorPay', req.session.user.email, `Payment ${payment.payment_no} deleted`, req.ip);
    await pushNotification('Vendor Payment Deleted', 'Payment ' + payment.payment_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
