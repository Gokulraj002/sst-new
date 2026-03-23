'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextCustomerNo() {
  const row = await queryOne("SELECT customer_no FROM customers WHERE customer_no LIKE 'CUS-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.customer_no) return 'CUS-001';
  const num = parseInt(row.customer_no.split('-')[1], 10) + 1;
  return `CUS-${String(num).padStart(3, '0')}`;
}

router.get('/api/customers/list', requireLogin, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', tier = '', sort = 'total_spent', order = 'desc' } = req.query;
    const pg = Math.max(1, parseInt(page));
    const lmt = Math.min(200, Math.max(10, parseInt(limit)));
    const offset = (pg - 1) * lmt;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx} OR city ILIKE $${idx} OR customer_no ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    if (tier) { conditions.push(`loyalty_tier = $${idx++}`); params.push(tier); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSort = { total_spent: 'total_spent', name: 'name', total_bookings: 'total_bookings', created_at: 'created_at' };
    const sortCol = validSort[sort] || 'total_spent';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const [rows, countRow] = await Promise.all([
      query(`SELECT * FROM customers ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, lmt, offset]),
      queryOne(`SELECT COUNT(*) AS total FROM customers ${where}`, params),
    ]);
    const total = parseInt(countRow.total, 10);
    res.json({
      success: true,
      customers: rows,
      pagination: { page: pg, limit: lmt, total, pages: Math.ceil(total / lmt) },
    });
  } catch (err) { next(err); }
});

router.get('/api/customers/export', requireLogin, async (req, res, next) => {
  try {
    const { search = '', tier = '' } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (search) { conditions.push(`(name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (tier)   { conditions.push(`loyalty_tier = $${idx++}`); params.push(tier); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const customers = await query(`SELECT customer_no, name, email, phone, city, total_bookings, total_spent, last_travel_date, loyalty_tier, notes FROM customers ${where} ORDER BY total_spent DESC`, params);
    const headers = ['Customer#', 'Name', 'Email', 'Phone', 'City', 'Bookings', 'Total Spent', 'Last Travel', 'Loyalty Tier', 'Notes'];
    const csvRows = [headers.join(',')];
    customers.forEach(c => {
      csvRows.push([
        c.customer_no, `"${(c.name || '').replace(/"/g, '""')}"`, c.email || '', c.phone || '',
        c.city || '', c.total_bookings || 0, c.total_spent || 0, c.last_travel_date || '',
        c.loyalty_tier || '', `"${(c.notes || '').replace(/"/g, '""')}"`
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=customers_${Date.now()}.csv`);
    res.send(csvRows.join('\n'));
  } catch (err) { next(err); }
});

router.get('/api/customers/get/:id', requireLogin, async (req, res, next) => {
  try {
    const customer = await queryOne('SELECT * FROM customers WHERE id=$1', [req.params.id]);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    res.json({ success: true, customer });
  } catch (err) { next(err); }
});

router.post('/api/customers/add', requireLogin, async (req, res, next) => {
  try {
    const customer_no = await nextCustomerNo();
    const {
      name, email, phone, city, total_bookings = 0, total_spent = 0,
      last_travel_date, loyalty_tier = 'Regular', notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO customers
        (customer_no, name, email, phone, city, total_bookings, total_spent, last_travel_date, loyalty_tier, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [customer_no, name, email, phone, city, total_bookings, total_spent, last_travel_date, loyalty_tier, notes]
    );
    const customer = rows[0];
    await logAudit('Created Customer', 'Customers', req.session.user.email, `Customer ${customer_no} — ${name} added`, req.ip);
    await pushNotification('New Customer', 'Customer ' + customer_no + ' — ' + name + ' added', 'success', 'all');
    res.json({ success: true, customer });
  } catch (err) { next(err); }
});

router.post('/api/customers/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM customers WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Customer not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE customers SET name=$1, email=$2, phone=$3, city=$4, total_bookings=$5,
       total_spent=$6, last_travel_date=$7, loyalty_tier=$8, notes=$9 WHERE id=$10`,
      [m.name, m.email, m.phone, m.city, m.total_bookings,
       m.total_spent, m.last_travel_date, m.loyalty_tier, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM customers WHERE id=$1', [req.params.id]);
    await logAudit('Updated Customer', 'Customers', req.session.user.email, `Customer ${existing.customer_no} updated`, req.ip);
    await pushNotification('Customer Updated', 'Customer ' + existing.customer_no + ' updated', 'info', 'all');
    res.json({ success: true, customer: updated });
  } catch (err) { next(err); }
});

router.post('/api/customers/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const customer = await queryOne('SELECT * FROM customers WHERE id=$1', [req.params.id]);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    await query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Customer', 'Customers', req.session.user.email, `Customer ${customer.customer_no} deleted`, req.ip);
    await pushNotification('Customer Deleted', 'Customer ' + customer.customer_no + ' — ' + customer.name + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
