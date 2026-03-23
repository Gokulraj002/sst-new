'use strict';

require('dotenv').config();
const { pool, query, queryOne } = require('./src/config/db');
const { hashPassword } = require('./src/utils/passwordHelper');

async function seed() {
  console.log('Seeding database...');

  // Create all tables
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
    );
    CREATE TABLE IF NOT EXISTS leads (
      id BIGSERIAL PRIMARY KEY,
      lead_no TEXT UNIQUE,
      client_name TEXT NOT NULL,
      phone TEXT,
      destination TEXT,
      pax INTEGER DEFAULT 1,
      budget NUMERIC(12,2) DEFAULT 0,
      source TEXT DEFAULT 'WhatsApp',
      assigned_to TEXT,
      stage TEXT DEFAULT 'New Enquiry',
      temperature TEXT DEFAULT 'Warm',
      follow_up_date TEXT,
      travel_date TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS quotations (
      id BIGSERIAL PRIMARY KEY,
      quote_no TEXT UNIQUE,
      client TEXT NOT NULL,
      destination TEXT,
      pax INTEGER DEFAULT 1,
      duration TEXT,
      amount NUMERIC(12,2) DEFAULT 0,
      prepared_by TEXT,
      date_sent TEXT,
      valid_until TEXT,
      status TEXT DEFAULT 'Awaiting',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      booking_no TEXT UNIQUE,
      client TEXT NOT NULL,
      phone TEXT,
      destination TEXT,
      tour_type TEXT DEFAULT 'FIT',
      pax INTEGER DEFAULT 1,
      depart_date TEXT,
      return_date TEXT,
      sales_person TEXT,
      package_amount NUMERIC(12,2) DEFAULT 0,
      advance_paid NUMERIC(12,2) DEFAULT 0,
      payment_mode TEXT DEFAULT 'UPI',
      status TEXT DEFAULT 'Confirmed',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      task TEXT NOT NULL,
      related_to TEXT,
      assigned_to TEXT,
      priority TEXT DEFAULT 'Medium',
      due_date TEXT,
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS visa_applications (
      id BIGSERIAL PRIMARY KEY,
      visa_no TEXT UNIQUE,
      client TEXT NOT NULL,
      booking_ref TEXT,
      destination TEXT,
      visa_type TEXT,
      pax INTEGER DEFAULT 1,
      applied_on TEXT,
      expected_by TEXT,
      handled_by TEXT,
      status TEXT DEFAULT 'Docs Collecting',
      docs_status TEXT DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id BIGSERIAL PRIMARY KEY,
      invoice_no TEXT UNIQUE,
      client TEXT NOT NULL,
      booking_ref TEXT,
      invoice_date TEXT,
      due_date TEXT,
      amount NUMERIC(12,2) DEFAULT 0,
      paid NUMERIC(12,2) DEFAULT 0,
      gst_rate NUMERIC(12,2) DEFAULT 5,
      gst_amount NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'Unpaid',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS employees (
      id BIGSERIAL PRIMARY KEY,
      emp_no TEXT UNIQUE,
      name TEXT NOT NULL,
      designation TEXT,
      department TEXT,
      phone TEXT,
      email TEXT,
      date_of_join TEXT,
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vendors (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      location TEXT,
      rating INTEGER DEFAULT 4,
      phone TEXT,
      email TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id BIGSERIAL PRIMARY KEY,
      expense_no TEXT UNIQUE,
      category TEXT DEFAULT 'Office',
      description TEXT NOT NULL,
      amount NUMERIC(12,2) DEFAULT 0,
      paid_by TEXT,
      payment_mode TEXT DEFAULT 'Cash',
      expense_date TEXT,
      receipt TEXT,
      status TEXT DEFAULT 'Pending',
      approved_by TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vouchers (
      id BIGSERIAL PRIMARY KEY,
      voucher_no TEXT UNIQUE,
      voucher_type TEXT DEFAULT 'Payment',
      party_name TEXT NOT NULL,
      amount NUMERIC(12,2) DEFAULT 0,
      narration TEXT,
      voucher_date TEXT,
      prepared_by TEXT,
      approved_by TEXT,
      status TEXT DEFAULT 'Draft',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS refunds (
      id BIGSERIAL PRIMARY KEY,
      refund_no TEXT UNIQUE,
      client TEXT NOT NULL,
      booking_ref TEXT,
      original_amount NUMERIC(12,2) DEFAULT 0,
      refund_amount NUMERIC(12,2) DEFAULT 0,
      reason TEXT,
      refund_mode TEXT DEFAULT 'NEFT',
      refund_date TEXT,
      processed_by TEXT,
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS customers (
      id BIGSERIAL PRIMARY KEY,
      customer_no TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      city TEXT,
      total_bookings INTEGER DEFAULT 0,
      total_spent NUMERIC(12,2) DEFAULT 0,
      last_travel_date TEXT,
      loyalty_tier TEXT DEFAULT 'Regular',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS commissions (
      id BIGSERIAL PRIMARY KEY,
      commission_no TEXT UNIQUE,
      staff_name TEXT NOT NULL,
      booking_ref TEXT,
      client TEXT,
      booking_amount NUMERIC(12,2) DEFAULT 0,
      commission_rate NUMERIC(12,2) DEFAULT 5,
      commission_amount NUMERIC(12,2) DEFAULT 0,
      month TEXT,
      status TEXT DEFAULT 'Pending',
      paid_date TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id BIGSERIAL PRIMARY KEY,
      approval_no TEXT UNIQUE,
      request_type TEXT DEFAULT 'Expense',
      requested_by TEXT NOT NULL,
      description TEXT,
      amount NUMERIC(12,2) DEFAULT 0,
      request_date TEXT,
      status TEXT DEFAULT 'Pending',
      approved_by TEXT,
      approved_date TEXT,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      module TEXT,
      performed_by TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      doc_no TEXT UNIQUE,
      title TEXT NOT NULL,
      doc_type TEXT DEFAULT 'General',
      related_to TEXT,
      uploaded_by TEXT,
      file_path TEXT,
      status TEXT DEFAULT 'Active',
      expiry_date TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS group_inventory (
      id BIGSERIAL PRIMARY KEY,
      tour_name TEXT NOT NULL,
      destination TEXT,
      departure_date TEXT,
      return_date TEXT,
      total_seats INTEGER DEFAULT 0,
      booked_seats INTEGER DEFAULT 0,
      price_per_pax NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'Open',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS itineraries (
      id BIGSERIAL PRIMARY KEY,
      template_code TEXT UNIQUE,
      title TEXT NOT NULL,
      destination TEXT,
      duration TEXT,
      tour_type TEXT DEFAULT 'Domestic',
      rating INTEGER DEFAULT 4,
      day_wise TEXT,
      inclusions TEXT,
      exclusions TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT,
      notification_type TEXT DEFAULT 'info',
      target_user TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vendor_payments (
      id BIGSERIAL PRIMARY KEY,
      payment_no TEXT UNIQUE,
      vendor_id INTEGER,
      vendor_name TEXT NOT NULL,
      booking_ref TEXT,
      amount NUMERIC(12,2) DEFAULT 0,
      payment_date TEXT,
      payment_mode TEXT DEFAULT 'NEFT',
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  console.log('All tables created.');

  // Create admin user if not exists
  const existing = await queryOne('SELECT id FROM users WHERE email=$1', ['admin@ssttours.com']);
  if (existing) {
    console.log('Admin user already exists, skipping.');
  } else {
    const hashedPw = await hashPassword('admin123');
    await query(
      `INSERT INTO users (name, email, password, role, department, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Gajendra SR', 'admin@ssttours.com', hashedPw, 'admin', 'Management', 'active']
    );
    console.log('Admin user created: admin@ssttours.com / admin123');
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
