'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextInvoiceNo() {
  const row = await queryOne("SELECT invoice_no FROM invoices WHERE invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.invoice_no) return 'INV-2026-001';
  const parts = row.invoice_no.split('-');
  const num = parseInt(parts[parts.length - 1], 10) + 1;
  const year = parts[1] || '2026';
  return `INV-${year}-${String(num).padStart(3, '0')}`;
}

router.get('/api/invoices/list', requireLogin, async (req, res, next) => {
  try {
    const invoices = await query('SELECT * FROM invoices ORDER BY id DESC');
    res.json({ success: true, invoices });
  } catch (err) { next(err); }
});

router.get('/api/invoices/get/:id', requireLogin, async (req, res, next) => {
  try {
    const invoice = await queryOne('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
});

router.post('/api/invoices/add', requireLogin, async (req, res, next) => {
  try {
    const invoice_no = await nextInvoiceNo();
    const {
      client, booking_ref, invoice_date, due_date,
      amount = 0, paid = 0, gst_rate = 5, gst_amount = 0, status = 'Unpaid',
    } = req.body;
    const rows = await query(
      `INSERT INTO invoices
        (invoice_no, client, booking_ref, invoice_date, due_date, amount, paid, gst_rate, gst_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [invoice_no, client, booking_ref, invoice_date, due_date, amount, paid, gst_rate, gst_amount, status]
    );
    const invoice = rows[0];
    await logAudit('Created Invoice', 'Finance', req.session.user.email, `Invoice ${invoice_no} for ${client}`, req.ip);
    await pushNotification('Invoice Created', 'Invoice ' + invoice_no + ' for ' + client + ' created', 'info', 'all');
    res.json({ success: true, invoice });
  } catch (err) { next(err); }
});

router.post('/api/invoices/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Invoice not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE invoices SET client=$1, booking_ref=$2, invoice_date=$3, due_date=$4, amount=$5,
       paid=$6, gst_rate=$7, gst_amount=$8, status=$9 WHERE id=$10`,
      [m.client, m.booking_ref, m.invoice_date, m.due_date, m.amount,
       m.paid, m.gst_rate, m.gst_amount, m.status, req.params.id]
    );
    if (req.body.status === 'Paid' && existing.status !== 'Paid') {
      await pushNotification('Payment Received', `Invoice ${existing.invoice_no} marked as Paid`, 'success', 'all');
    }
    const updated = await queryOne('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    await logAudit('Updated Invoice', 'Finance', req.session.user.email, `Invoice ${existing.invoice_no} updated`, req.ip);
    res.json({ success: true, invoice: updated });
  } catch (err) { next(err); }
});

router.post('/api/invoices/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const invoice = await queryOne('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    await query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Invoice', 'Finance', req.session.user.email, `Invoice ${invoice.invoice_no} deleted`, req.ip);
    await pushNotification('Invoice Deleted', 'Invoice ' + invoice.invoice_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
