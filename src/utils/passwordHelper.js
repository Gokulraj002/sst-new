'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Verify a Werkzeug pbkdf2 hash (format: pbkdf2:sha256:iterations$salt$hash)
 * Used to authenticate existing Python-created user passwords.
 */
function verifyWerkzeugHash(password, hashString) {
  try {
    // Format: pbkdf2:sha256:260000$salt$hash
    const colonParts = hashString.split(':');
    if (colonParts.length < 3) return false;
    // colonParts = ['pbkdf2', 'sha256', '260000$salt$hexhash']
    const rest = colonParts.slice(2).join(':'); // handle algo with colons
    const dollarParts = rest.split('$');
    if (dollarParts.length < 3) return false;
    const iterations = parseInt(dollarParts[0], 10);
    const salt = dollarParts[1];
    const storedHash = dollarParts[2];
    if (!iterations || !salt || !storedHash) return false;
    const keyLen = storedHash.length / 2; // hex string → byte length
    const key = crypto.pbkdf2Sync(password, salt, iterations, keyLen, 'sha256');
    return key.toString('hex') === storedHash;
  } catch {
    return false;
  }
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt hashes ($2b$…) and Werkzeug pbkdf2 hashes.
 */
async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  if (hash.startsWith('pbkdf2:')) {
    return verifyWerkzeugHash(password, hash);
  }
  return bcrypt.compare(password, hash);
}

/**
 * Hash a plain-text password with bcrypt (12 rounds).
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

module.exports = { hashPassword, verifyPassword };
