'use strict';

const { pool } = require('../config/db');

/**
 * Insert a notification into the DB.
 * @param {string} title
 * @param {string} message
 * @param {string} [type]   - info | success | warning | error
 * @param {string} [target] - 'all' or a specific user email
 */
async function pushNotification(title, message, type = 'info', target = 'all') {
  try {
    await pool.query(
      'INSERT INTO notifications (title, message, notification_type, target_user, is_read) VALUES ($1,$2,$3,$4,FALSE)',
      [title, message, type, target]
    );
  } catch (err) {
    console.error('[notifications] Failed to push notification:', err.message);
  }
}

module.exports = { pushNotification };
