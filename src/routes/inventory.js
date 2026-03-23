'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

router.get('/api/inventory/list', requireLogin, async (req, res, next) => {
  try {
    const inventory = await query('SELECT * FROM group_inventory ORDER BY id DESC');
    res.json({ success: true, inventory });
  } catch (err) { next(err); }
});

router.get('/api/inventory/get/:id', requireLogin, async (req, res, next) => {
  try {
    const item = await queryOne('SELECT * FROM group_inventory WHERE id=$1', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: 'Inventory item not found' });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

router.post('/api/inventory/add', requireLogin, async (req, res, next) => {
  try {
    const {
      tour_name, destination, departure_date, return_date,
      total_seats = 0, booked_seats = 0, price_per_pax = 0, status = 'Open', notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO group_inventory
        (tour_name, destination, departure_date, return_date, total_seats, booked_seats, price_per_pax, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tour_name, destination, departure_date, return_date, total_seats, booked_seats, price_per_pax, status, notes]
    );
    const item = rows[0];
    await logAudit('Created Inventory', 'Inventory', req.session.user.email, `Tour ${tour_name} added`, req.ip);
    await pushNotification('Inventory Added', 'Tour ' + tour_name + ' added to inventory', 'success', 'all');
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

router.post('/api/inventory/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM group_inventory WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Inventory item not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE group_inventory SET tour_name=$1, destination=$2, departure_date=$3, return_date=$4,
       total_seats=$5, booked_seats=$6, price_per_pax=$7, status=$8, notes=$9 WHERE id=$10`,
      [m.tour_name, m.destination, m.departure_date, m.return_date,
       m.total_seats, m.booked_seats, m.price_per_pax, m.status, m.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM group_inventory WHERE id=$1', [req.params.id]);
    await logAudit('Updated Inventory', 'Inventory', req.session.user.email, `Tour ${existing.tour_name} updated`, req.ip);
    res.json({ success: true, item: updated });
  } catch (err) { next(err); }
});

router.post('/api/inventory/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const item = await queryOne('SELECT * FROM group_inventory WHERE id=$1', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: 'Inventory item not found' });
    await query('DELETE FROM group_inventory WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Inventory', 'Inventory', req.session.user.email, `Tour ${item.tour_name} deleted`, req.ip);
    await pushNotification('Inventory Deleted', 'Tour ' + item.tour_name + ' deleted from inventory', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
