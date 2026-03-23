'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

router.get('/api/vendors/list', requireLogin, async (req, res, next) => {
  try {
    const vendors = await query('SELECT * FROM vendors ORDER BY id');
    res.json({ success: true, vendors });
  } catch (err) { next(err); }
});

router.get('/api/vendors/get/:id', requireLogin, async (req, res, next) => {
  try {
    const vendor = await queryOne('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' });
    res.json({ success: true, vendor });
  } catch (err) { next(err); }
});

router.post('/api/vendors/add', requireLogin, async (req, res, next) => {
  try {
    const { name, type, location, rating = 4, phone, email } = req.body;
    const rows = await query(
      `INSERT INTO vendors (name, type, location, rating, phone, email) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, location, rating, phone, email]
    );
    const vendor = rows[0];
    await logAudit('Created Vendor', 'Vendors', req.session.user.email, `Vendor ${name} added`, req.ip);
    await pushNotification('New Vendor', 'Vendor ' + name + ' added', 'success', 'all');
    res.json({ success: true, vendor });
  } catch (err) { next(err); }
});

router.post('/api/vendors/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Vendor not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE vendors SET name=$1, type=$2, location=$3, rating=$4, phone=$5, email=$6 WHERE id=$7`,
      [m.name, m.type, m.location, m.rating, m.phone, m.email, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
    await logAudit('Updated Vendor', 'Vendors', req.session.user.email, `Vendor ${existing.name} updated`, req.ip);
    res.json({ success: true, vendor: updated });
  } catch (err) { next(err); }
});

router.post('/api/vendors/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const vendor = await queryOne('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' });
    await query('DELETE FROM vendors WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Vendor', 'Vendors', req.session.user.email, `Vendor ${vendor.name} deleted`, req.ip);
    await pushNotification('Vendor Deleted', 'Vendor ' + vendor.name + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
