'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextQuoteNo() {
  const row = await queryOne("SELECT quote_no FROM quotations WHERE quote_no LIKE 'Q-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.quote_no) return 'Q-2026-001';
  const parts = row.quote_no.split('-');
  const num = parseInt(parts[parts.length - 1], 10) + 1;
  const year = parts[1] || '2026';
  return `Q-${year}-${String(num).padStart(3, '0')}`;
}

router.get('/api/quotations/list', requireLogin, async (req, res, next) => {
  try {
    const quotations = await query('SELECT * FROM quotations ORDER BY id DESC');
    res.json({ success: true, quotations });
  } catch (err) { next(err); }
});

router.get('/api/quotations/get/:id', requireLogin, async (req, res, next) => {
  try {
    const quotation = await queryOne('SELECT * FROM quotations WHERE id=$1', [req.params.id]);
    if (!quotation) return res.status(404).json({ success: false, error: 'Quotation not found' });
    res.json({ success: true, quotation });
  } catch (err) { next(err); }
});

router.post('/api/quotations/add', requireLogin, async (req, res, next) => {
  try {
    const quote_no = await nextQuoteNo();
    const { client, destination, pax = 1, duration, amount = 0, prepared_by, date_sent, valid_until, status = 'Awaiting' } = req.body;
    const rows = await query(
      `INSERT INTO quotations (quote_no, client, destination, pax, duration, amount, prepared_by, date_sent, valid_until, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [quote_no, client, destination, pax, duration, amount, prepared_by, date_sent, valid_until, status]
    );
    const quotation = rows[0];
    await logAudit('Created Quotation', 'Quotations', req.session.user.email, `Quotation ${quote_no} for ${client}`, req.ip);
    await pushNotification('Quotation Created', 'Quotation ' + quote_no + ' for ' + client + ' created', 'info', 'all');
    res.json({ success: true, quotation });
  } catch (err) { next(err); }
});

router.post('/api/quotations/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM quotations WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE quotations SET client=$1, destination=$2, pax=$3, duration=$4, amount=$5,
       prepared_by=$6, date_sent=$7, valid_until=$8, status=$9 WHERE id=$10`,
      [m.client, m.destination, m.pax, m.duration, m.amount, m.prepared_by, m.date_sent, m.valid_until, m.status, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM quotations WHERE id=$1', [req.params.id]);
    await logAudit('Updated Quotation', 'Quotations', req.session.user.email, `Quotation ${existing.quote_no} updated`, req.ip);
    await pushNotification('Quotation Updated', 'Quotation ' + existing.quote_no + ' updated', 'info', 'all');
    res.json({ success: true, quotation: updated });
  } catch (err) { next(err); }
});

router.post('/api/quotations/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const quotation = await queryOne('SELECT * FROM quotations WHERE id=$1', [req.params.id]);
    if (!quotation) return res.status(404).json({ success: false, error: 'Quotation not found' });
    await query('DELETE FROM quotations WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Quotation', 'Quotations', req.session.user.email, `Quotation ${quotation.quote_no} deleted`, req.ip);
    await pushNotification('Quotation Deleted', 'Quotation ' + quotation.quote_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
