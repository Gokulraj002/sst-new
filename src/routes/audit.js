'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// GET /api/audit/list — with optional filtering and pagination
// Query params: ?module=, ?action=, ?user=, ?search=, ?limit=, ?offset=
router.get('/api/audit/list', requireLogin, async (req, res, next) => {
  try {
    const { module: mod, action, user, search, limit = 200, offset = 0 } = req.query;

    let where = [];
    let params = [];
    let idx = 1;

    if (mod) {
      where.push(`module = $${idx++}`);
      params.push(mod);
    }
    if (action) {
      where.push(`action ILIKE $${idx++}`);
      params.push(`%${action}%`);
    }
    if (user) {
      where.push(`performed_by ILIKE $${idx++}`);
      params.push(`%${user}%`);
    }
    if (search) {
      where.push(`(action ILIKE $${idx} OR performed_by ILIKE $${idx} OR details ILIKE $${idx} OR module ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const logs = await query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Count totals for pagination
    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
      params
    );

    // Get distinct modules for filter dropdown
    const moduleRows = await query('SELECT DISTINCT module FROM audit_logs WHERE module IS NOT NULL ORDER BY module');
    const modules = moduleRows.map((r) => r.module);

    res.json({
      success: true,
      logs,
      total: parseInt(countRow.total, 10),
      modules,
    });
  } catch (err) { next(err); }
});

// GET /api/audit/stats — summary stats for dashboard
router.get('/api/audit/stats', requireLogin, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [totalRow, todayRow, moduleRows] = await Promise.all([
      queryOne('SELECT COUNT(*) AS v FROM audit_logs'),
      queryOne(`SELECT COUNT(*) AS v FROM audit_logs WHERE created_at::DATE = '${today}'::DATE`),
      query('SELECT module, COUNT(*) AS count FROM audit_logs WHERE module IS NOT NULL GROUP BY module ORDER BY count DESC LIMIT 10'),
    ]);
    res.json({
      success: true,
      total: parseInt(totalRow.v, 10),
      today: parseInt(todayRow.v, 10),
      by_module: moduleRows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
