'use strict';

const { pool, queryOne } = require('./src/config/db');
const { hashPassword } = require('./src/utils/passwordHelper');
const app = require('./src/app');

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

// Auto-seed: create users table + admin user if missing
async function autoSeed() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'staff',
        department TEXT DEFAULT 'Sales',
        last_login TEXT,
        status TEXT DEFAULT 'active',
        permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const existing = await queryOne('SELECT id FROM users WHERE email=$1', ['admin@ssttours.com']);
    if (!existing) {
      const hashedPw = await hashPassword('admin123');
      await pool.query(
        `INSERT INTO users (name, email, password, role, department, status) VALUES ($1,$2,$3,$4,$5,$6)`,
        ['Gajendra SR', 'admin@ssttours.com', hashedPw, 'admin', 'Management', 'active']
      );
      console.log('  ✅ Admin user created: admin@ssttours.com / admin123');
    } else {
      console.log('  ✅ Admin user exists');
    }
  } catch (err) {
    console.warn('  ⚠️  Auto-seed warning:', err.message);
  }
}

app.listen(PORT, HOST, async () => {
  console.log(`\n  SST ERP backend running on http://localhost:${PORT}`);
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Frontend    : ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`  Database    : ${(process.env.DATABASE_URL || '').replace(/:([^:@]+)@/, ':****@')}\n`);
  await autoSeed();
});
