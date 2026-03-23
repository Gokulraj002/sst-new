'use strict';

const { pool } = require('../config/db');

/**
 * Insert an audit log entry.
 * @param {string} action
 * @param {string} module
 * @param {string} performedBy
 * @param {string} details
 * @param {string} [ip]
 */
async function logAudit(action, module, performedBy, details, ip = 'system') {
  try {
    await pool.query(
      'INSERT INTO audit_logs (action, module, performed_by, details, ip_address) VALUES ($1,$2,$3,$4,$5)',
      [action, module, performedBy, details, ip]
    );
  } catch (err) {
    console.error('[auditLogger] Failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
