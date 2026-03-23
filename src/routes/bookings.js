'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextBookingNo() {
  const row = await queryOne("SELECT booking_no FROM bookings WHERE booking_no LIKE 'BK-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.booking_no) return 'BK-2026-001';
  const parts = row.booking_no.split('-');
  const num = parseInt(parts[parts.length - 1], 10) + 1;
  const year = parts[1] || '2026';
  return `BK-${year}-${String(num).padStart(3, '0')}`;
}

router.get('/api/bookings/list', requireLogin, async (req, res, next) => {
  try {
    const bookings = await query('SELECT * FROM bookings ORDER BY id DESC');
    res.json({ success: true, bookings });
  } catch (err) { next(err); }
});

router.get('/api/bookings/get/:id', requireLogin, async (req, res, next) => {
  try {
    const booking = await queryOne('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    res.json({ success: true, booking });
  } catch (err) { next(err); }
});

router.post('/api/bookings/add', requireLogin, async (req, res, next) => {
  try {
    const booking_no = await nextBookingNo();
    const {
      client, phone, destination, tour_type = 'FIT', pax = 1,
      depart_date, return_date, sales_person,
      package_amount = 0, advance_paid = 0, payment_mode = 'UPI', status = 'Confirmed',
    } = req.body;
    const rows = await query(
      `INSERT INTO bookings
        (booking_no, client, phone, destination, tour_type, pax, depart_date, return_date,
         sales_person, package_amount, advance_paid, payment_mode, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [booking_no, client, phone, destination, tour_type, pax, depart_date, return_date,
       sales_person, package_amount, advance_paid, payment_mode, status]
    );
    const booking = rows[0];
    await logAudit('Created Booking', 'Bookings', req.session.user.email, `Booking ${booking_no} confirmed for ${client}`, req.ip);
    await pushNotification('New Booking', `Booking ${booking_no} — ${client} added`, 'success', 'all');
    res.json({ success: true, booking });
  } catch (err) { next(err); }
});

router.post('/api/bookings/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Booking not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE bookings SET client=$1, phone=$2, destination=$3, tour_type=$4, pax=$5,
       depart_date=$6, return_date=$7, sales_person=$8, package_amount=$9,
       advance_paid=$10, payment_mode=$11, status=$12 WHERE id=$13`,
      [m.client, m.phone, m.destination, m.tour_type, m.pax,
       m.depart_date, m.return_date, m.sales_person, m.package_amount,
       m.advance_paid, m.payment_mode, m.status, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    await logAudit('Updated Booking', 'Bookings', req.session.user.email, `Booking ${existing.booking_no} updated`, req.ip);
    await pushNotification('Booking Updated', 'Booking ' + existing.booking_no + ' — ' + existing.client + ' updated', 'info', 'all');
    res.json({ success: true, booking: updated });
  } catch (err) { next(err); }
});

router.post('/api/bookings/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const booking = await queryOne('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    await query('DELETE FROM bookings WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Booking', 'Bookings', req.session.user.email, `Booking ${booking.booking_no} deleted`, req.ip);
    await pushNotification('Booking Cancelled', 'Booking ' + booking.booking_no + ' — ' + booking.client + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
