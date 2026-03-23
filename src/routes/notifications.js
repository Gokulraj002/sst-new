'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// GET /api/notifications/list
router.get('/api/notifications/list', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    const notifications = await query(
      "SELECT * FROM notifications WHERE (target_user='all' OR target_user=$1) ORDER BY created_at DESC LIMIT 200",
      [email]
    );
    res.json({ success: true, notifications });
  } catch (err) { next(err); }
});

// GET /api/notifications/unread_count
router.get('/api/notifications/unread_count', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    const row = await queryOne(
      "SELECT COUNT(*) AS count FROM notifications WHERE is_read=FALSE AND (target_user='all' OR target_user=$1)",
      [email]
    );
    res.json({ success: true, count: parseInt(row.count, 10) });
  } catch (err) { next(err); }
});

// GET /api/notifications/count (alias)
router.get('/api/notifications/count', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    const row = await queryOne(
      "SELECT COUNT(*) AS count FROM notifications WHERE is_read=FALSE AND (target_user='all' OR target_user=$1)",
      [email]
    );
    res.json({ success: true, count: parseInt(row.count, 10) });
  } catch (err) { next(err); }
});

// POST /api/notifications/mark_read/:id
router.post('/api/notifications/mark_read/:id', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    await query(
      "UPDATE notifications SET is_read=TRUE WHERE id=$1 AND (target_user='all' OR target_user=$2)",
      [req.params.id, email]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/read/:id (alias)
router.post('/api/notifications/read/:id', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    await query(
      "UPDATE notifications SET is_read=TRUE WHERE id=$1 AND (target_user='all' OR target_user=$2)",
      [req.params.id, email]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/mark_all_read
router.post('/api/notifications/mark_all_read', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    await query(
      "UPDATE notifications SET is_read=TRUE WHERE is_read=FALSE AND (target_user='all' OR target_user=$1)",
      [email]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/read-all (alias)
router.post('/api/notifications/read-all', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    await query(
      "UPDATE notifications SET is_read=TRUE WHERE is_read=FALSE AND (target_user='all' OR target_user=$1)",
      [email]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/read_all (alias)
router.post('/api/notifications/read_all', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    await query(
      "UPDATE notifications SET is_read=TRUE WHERE is_read=FALSE AND (target_user='all' OR target_user=$1)",
      [email]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/delete/:id
router.delete('/api/notifications/delete/:id', requireLogin, async (req, res, next) => {
  try {
    await query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/delete/:id (alternative for clients that can't send DELETE)
router.post('/api/notifications/delete/:id', requireLogin, async (req, res, next) => {
  try {
    await query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/clear_all
router.post('/api/notifications/clear_all', requireLogin, async (req, res, next) => {
  try {
    const email = req.session.user.email;
    await query(
      "DELETE FROM notifications WHERE target_user='all' OR target_user=$1",
      [email]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
