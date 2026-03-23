'use strict';

/**
 * requireLogin — protect any route that needs an authenticated user.
 * Returns 401 JSON (NOT a redirect) so the React frontend can handle it.
 */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

/**
 * requireAdmin — protect admin-only routes.
 * Must be used AFTER requireLogin (or it will give a 403 even for unauthenticated users).
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
