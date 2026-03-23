'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

// GET /api/settings/get — return all settings as { key: value } object
router.get('/api/settings/get', requireLogin, async (req, res, next) => {
  try {
    const rows = await query('SELECT key, value FROM app_settings');
    const settings = {};
    rows.forEach((r) => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

// POST /api/settings/save — upsert { key, value } pairs
router.post('/api/settings/save', requireAdmin, async (req, res, next) => {
  try {
    const data = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(data)) {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
        [key, String(value)]
      );
    }
    await logAudit('Updated Settings', 'Settings', req.session.user.email, 'App settings saved', req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
