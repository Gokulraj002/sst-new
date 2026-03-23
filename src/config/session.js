'use strict';

require('dotenv').config();
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');

const isProduction = process.env.NODE_ENV === 'production';

const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: 'session',      // connect-pg-simple will create this table
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'sst-erp-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,          // trust the reverse-proxy (Netlify/Render)
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

module.exports = sessionMiddleware;
