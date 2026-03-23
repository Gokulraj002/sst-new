'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const sessionMiddleware = require('./config/session');
const routes = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const { pool } = require('./config/db');

// ── Auto-migrate: add permissions column if not exists ────────────────────────
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb`)
  .catch((err) => console.warn('permissions migration skipped:', err.message));

// ── Auto-migrate: performance indexes + lead_activities table ─────────────────
const indexQueries = [
  `CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_client_name ON leads USING gin(to_tsvector('simple', COALESCE(client_name,'')))`,
  `CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING gin(to_tsvector('simple', COALESCE(name,'')))`,
  `CREATE INDEX IF NOT EXISTS idx_customers_loyalty_tier ON customers(loyalty_tier)`,
  `CREATE TABLE IF NOT EXISTS lead_activities (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL,
    lead_no TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    done_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id)`,
];
Promise.all(indexQueries.map(q => pool.query(q)))
  .catch(err => console.warn('Index migration:', err.message));

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (e.g. curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Session ───────────────────────────────────────────────────────────────────
app.use(sessionMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', routes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 for unmatched API routes ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
