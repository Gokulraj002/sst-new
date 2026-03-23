'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextTemplateCode(destination) {
  const prefix = destination ? `TMP-${destination.substring(0, 3).toUpperCase()}-` : 'TMP-';
  const row = await queryOne(
    "SELECT template_code FROM itineraries WHERE template_code LIKE $1 ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  );
  if (!row || !row.template_code) return `${prefix}001`;
  const last = row.template_code;
  const numStr = last.replace(prefix, '');
  const num = parseInt(numStr, 10) + 1;
  return `${prefix}${String(num).padStart(3, '0')}`;
}

router.get('/api/itineraries/list', requireLogin, async (req, res, next) => {
  try {
    const itineraries = await query('SELECT * FROM itineraries ORDER BY id DESC');
    res.json({ success: true, itineraries });
  } catch (err) { next(err); }
});

router.get('/api/itineraries/get/:id', requireLogin, async (req, res, next) => {
  try {
    const itinerary = await queryOne('SELECT * FROM itineraries WHERE id=$1', [req.params.id]);
    if (!itinerary) return res.status(404).json({ success: false, error: 'Itinerary not found' });
    res.json({ success: true, itinerary });
  } catch (err) { next(err); }
});

router.post('/api/itineraries/add', requireLogin, async (req, res, next) => {
  try {
    const {
      template_code: providedCode, title, destination, duration,
      tour_type = 'Domestic', rating = 4, day_wise, inclusions, exclusions,
      base_price = null,
    } = req.body;
    const template_code = providedCode || await nextTemplateCode(destination);

    // Ensure base_price column exists (graceful)
    try {
      await query(`ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT NULL`);
    } catch {}

    const rows = await query(
      `INSERT INTO itineraries
        (template_code, title, destination, duration, tour_type, rating, day_wise, inclusions, exclusions, base_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [template_code, title, destination, duration, tour_type, rating, day_wise, inclusions, exclusions, base_price || null]
    );
    const itinerary = rows[0];
    await logAudit('Created Itinerary', 'Itineraries', req.session.user.email, `Itinerary ${template_code}: ${title}`, req.ip);
    await pushNotification('Itinerary Created', `Itinerary ${template_code} — ${title} created`, 'info', 'all');
    res.json({ success: true, itinerary });
  } catch (err) { next(err); }
});

router.post('/api/itineraries/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM itineraries WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Itinerary not found' });
    const m = { ...existing, ...req.body };

    // Ensure base_price column exists (graceful)
    try {
      await query(`ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT NULL`);
    } catch {}

    await query(
      `UPDATE itineraries SET title=$1, destination=$2, duration=$3, tour_type=$4,
       rating=$5, day_wise=$6, inclusions=$7, exclusions=$8, base_price=$9 WHERE id=$10`,
      [m.title, m.destination, m.duration, m.tour_type,
       m.rating, m.day_wise, m.inclusions, m.exclusions, m.base_price || null, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM itineraries WHERE id=$1', [req.params.id]);
    await logAudit('Updated Itinerary', 'Itineraries', req.session.user.email, `Itinerary ${existing.template_code} updated`, req.ip);
    res.json({ success: true, itinerary: updated });
  } catch (err) { next(err); }
});

router.post('/api/itineraries/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const itinerary = await queryOne('SELECT * FROM itineraries WHERE id=$1', [req.params.id]);
    if (!itinerary) return res.status(404).json({ success: false, error: 'Itinerary not found' });
    await query('DELETE FROM itineraries WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Itinerary', 'Itineraries', req.session.user.email, `Itinerary ${itinerary.template_code} deleted`, req.ip);
    await pushNotification('Itinerary Deleted', `Itinerary ${itinerary.template_code} deleted`, 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
