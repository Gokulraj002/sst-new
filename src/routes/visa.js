'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextVisaNo() {
  const row = await queryOne("SELECT visa_no FROM visa_applications WHERE visa_no LIKE 'V-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.visa_no) return 'V-2026-001';
  const parts = row.visa_no.split('-');
  const num = parseInt(parts[parts.length - 1], 10) + 1;
  const year = parts[1] || '2026';
  return `V-${year}-${String(num).padStart(3, '0')}`;
}

router.get('/api/visa/list', requireLogin, async (req, res, next) => {
  try {
    const visas = await query('SELECT * FROM visa_applications ORDER BY id DESC');
    res.json({ success: true, visas });
  } catch (err) { next(err); }
});

router.get('/api/visa/get/:id', requireLogin, async (req, res, next) => {
  try {
    const visa = await queryOne('SELECT * FROM visa_applications WHERE id=$1', [req.params.id]);
    if (!visa) return res.status(404).json({ success: false, error: 'Visa application not found' });
    res.json({ success: true, visa });
  } catch (err) { next(err); }
});

router.post('/api/visa/add', requireLogin, async (req, res, next) => {
  try {
    const visa_no = await nextVisaNo();
    const {
      client, booking_ref, destination, visa_type, pax = 1,
      applied_on, expected_by, handled_by,
      status = 'Docs Collecting', docs_status = 'Pending',
    } = req.body;
    const rows = await query(
      `INSERT INTO visa_applications
        (visa_no, client, booking_ref, destination, visa_type, pax, applied_on, expected_by, handled_by, status, docs_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [visa_no, client, booking_ref, destination, visa_type, pax, applied_on, expected_by, handled_by, status, docs_status]
    );
    const visa = rows[0];
    await logAudit('Created Visa Application', 'Visa', req.session.user.email, `Visa ${visa_no} for ${client}`, req.ip);
    await pushNotification('Visa Application Created', 'Visa ' + visa_no + ' for ' + client + ' created', 'info', 'all');
    res.json({ success: true, visa });
  } catch (err) { next(err); }
});

router.post('/api/visa/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM visa_applications WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Visa application not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE visa_applications SET client=$1, booking_ref=$2, destination=$3, visa_type=$4, pax=$5,
       applied_on=$6, expected_by=$7, handled_by=$8, status=$9, docs_status=$10 WHERE id=$11`,
      [m.client, m.booking_ref, m.destination, m.visa_type, m.pax,
       m.applied_on, m.expected_by, m.handled_by, m.status, m.docs_status, req.params.id]
    );
    if (req.body.status === 'Approved') {
      await pushNotification('Visa Approved', `Visa ${existing.visa_no} for ${existing.client} approved`, 'success', 'all');
    }
    const updated = await queryOne('SELECT * FROM visa_applications WHERE id=$1', [req.params.id]);
    await logAudit('Updated Visa', 'Visa', req.session.user.email, `Visa ${existing.visa_no} updated`, req.ip);
    res.json({ success: true, visa: updated });
  } catch (err) { next(err); }
});

router.post('/api/visa/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const visa = await queryOne('SELECT * FROM visa_applications WHERE id=$1', [req.params.id]);
    if (!visa) return res.status(404).json({ success: false, error: 'Visa application not found' });
    await query('DELETE FROM visa_applications WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Visa', 'Visa', req.session.user.email, `Visa ${visa.visa_no} deleted`, req.ip);
    await pushNotification('Visa Application Deleted', 'Visa ' + visa.visa_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
