'use strict';

const router = require('express').Router();
const { queryOne, query } = require('../config/db');
const { verifyPassword } = require('../utils/passwordHelper');
const { logAudit } = require('../utils/auditLogger');
const { requireLogin } = require('../middleware/auth');

// ─── Shared login handler ─────────────────────────────────────────────────────
async function handleLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const user = await queryOne('SELECT * FROM users WHERE email=$1', [email.trim()]);
    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Update last_login timestamp
    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    await query('UPDATE users SET last_login=$1 WHERE id=$2', [now, user.id]);

    // Store session (exclude password hash)
    const { password: _pw, ...userSafe } = user;
    req.session.user = userSafe;

    // Force session save to PostgreSQL before responding — ensures cookie is
    // committed to the DB so the very next request sees a valid session.
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    await logAudit('Login', 'Auth', email, `${user.name} logged in`, req.ip);
    return res.json({ success: true, user: userSafe });
  } catch (err) {
    next(err);
  }
}

// ─── Shared logout handler ────────────────────────────────────────────────────
function handleLogout(req, res) {
  req.session.destroy(() => {
    res.json({ success: true });
  });
}

// POST /api/auth/login   ← primary (used by React)
router.post('/api/auth/login', handleLogin);

// POST /login            ← legacy alias
router.post('/login', handleLogin);

// POST /api/auth/logout  ← primary (used by React)
router.post('/api/auth/logout', handleLogout);

// POST /logout           ← legacy alias
router.post('/logout', handleLogout);

// GET /logout            ← browser navigation fallback
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// GET /api/auth/check    ← session status
router.get('/api/auth/check', requireLogin, (req, res) => {
  res.json({ authenticated: true, user: req.session.user });
});

module.exports = router;
