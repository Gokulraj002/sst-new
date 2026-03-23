'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

// Auto-generate lead_no: L-001, L-002 …
async function nextLeadNo() {
  const row = await queryOne("SELECT lead_no FROM leads WHERE lead_no LIKE 'L-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.lead_no) return 'L-001';
  const num = parseInt(row.lead_no.split('-')[1], 10) + 1;
  return `L-${String(num).padStart(3, '0')}`;
}

// Auto-generate booking_no for lead conversion
async function nextBookingNo() {
  const row = await queryOne("SELECT booking_no FROM bookings WHERE booking_no LIKE 'BK-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.booking_no) return 'BK-2026-001';
  const parts = row.booking_no.split('-');
  const num = parseInt(parts[parts.length - 1], 10) + 1;
  const year = parts[1] || '2026';
  return `BK-${year}-${String(num).padStart(3, '0')}`;
}

// ── GET /api/leads/list — server-side pagination, filtering, sorting ───────────
router.get('/api/leads/list', requireLogin, async (req, res, next) => {
  try {
    const {
      page = 1, limit = 50,
      search = '', stage = '', temp = '', assigned = '', source = '',
      date_from = '', date_to = '',
      budget_min = '', budget_max = '',
      follow_up_status = '', // 'overdue' | 'today' | 'this_week' | 'none'
      travel_from = '', travel_to = '',
      sort = 'id', order = 'desc',
    } = req.query;

    const pg = Math.max(1, parseInt(page));
    const lmt = Math.min(200, Math.max(10, parseInt(limit)));
    const offset = (pg - 1) * lmt;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(client_name ILIKE $${idx} OR phone ILIKE $${idx} OR destination ILIKE $${idx} OR lead_no ILIKE $${idx} OR assigned_to ILIKE $${idx} OR source ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    if (stage)    { conditions.push(`stage = $${idx++}`);       params.push(stage); }
    if (temp)     { conditions.push(`temperature = $${idx++}`); params.push(temp); }
    if (assigned) { conditions.push(`assigned_to ILIKE $${idx++}`); params.push(`%${assigned}%`); }
    if (source)   { conditions.push(`source = $${idx++}`);      params.push(source); }

    // Date range (created_at)
    if (date_from) { conditions.push(`created_at::date >= $${idx++}`); params.push(date_from); }
    if (date_to)   { conditions.push(`created_at::date <= $${idx++}`); params.push(date_to); }

    // Budget range
    if (budget_min) { conditions.push(`budget >= $${idx++}`); params.push(parseFloat(budget_min)); }
    if (budget_max) { conditions.push(`budget <= $${idx++}`); params.push(parseFloat(budget_max)); }

    // Travel date range
    if (travel_from) { conditions.push(`travel_date >= $${idx++}`); params.push(travel_from); }
    if (travel_to)   { conditions.push(`travel_date <= $${idx++}`); params.push(travel_to); }

    // Follow-up status
    if (follow_up_status === 'overdue') {
      conditions.push(`follow_up_date < CURRENT_DATE AND stage NOT IN ('Converted','Lost')`);
    } else if (follow_up_status === 'today') {
      conditions.push(`follow_up_date = CURRENT_DATE`);
    } else if (follow_up_status === 'this_week') {
      conditions.push(`follow_up_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`);
    } else if (follow_up_status === 'none') {
      conditions.push(`follow_up_date IS NULL`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSort = { id: 'id', client_name: 'client_name', budget: 'budget', follow_up_date: 'follow_up_date', stage: 'stage', created_at: 'created_at', temperature: 'temperature', travel_date: 'travel_date', pax: 'pax' };
    const sortCol = validSort[sort] || 'id';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    const [rows, countRow, pipelineRows] = await Promise.all([
      query(`SELECT * FROM leads ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, lmt, offset]),
      queryOne(`SELECT COUNT(*) AS total, COALESCE(SUM(budget),0) as filtered_value FROM leads ${where}`, params),
      query(`SELECT stage, COUNT(*) as count, COALESCE(SUM(budget),0) as value FROM leads GROUP BY stage ORDER BY stage`),
    ]);

    const total = parseInt(countRow.total, 10);
    res.json({
      success: true,
      leads: rows,
      pagination: { page: pg, limit: lmt, total, pages: Math.ceil(total / lmt) },
      pipeline: pipelineRows,
      filtered_value: parseFloat(countRow.filtered_value || 0),
    });
  } catch (err) { next(err); }
});

// ── GET /api/leads/kanban — Kanban board view ─────────────────────────────────
router.get('/api/leads/kanban', requireLogin, async (req, res, next) => {
  try {
    const { search = '', temp = '', assigned = '', source = '' } = req.query;
    const conditions = [`(stage != 'Lost' OR created_at > NOW() - INTERVAL '30 days')`];
    const params = [];
    let idx = 1;
    if (search) {
      conditions.push(`(client_name ILIKE $${idx} OR phone ILIKE $${idx} OR destination ILIKE $${idx} OR lead_no ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    if (temp)     { conditions.push(`temperature = $${idx++}`);        params.push(temp); }
    if (assigned) { conditions.push(`assigned_to ILIKE $${idx++}`);    params.push(`%${assigned}%`); }
    if (source)   { conditions.push(`source = $${idx++}`);             params.push(source); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const leads = await query(`SELECT * FROM leads ${where} ORDER BY id DESC LIMIT 500`, params);
    const pipeline = await query(`SELECT stage, COUNT(*) as count, COALESCE(SUM(budget),0) as value FROM leads GROUP BY stage`);
    res.json({ success: true, leads, pipeline });
  } catch (err) { next(err); }
});

// ── GET /api/leads/stats — analytics ─────────────────────────────────────────
router.get('/api/leads/stats', requireLogin, async (req, res, next) => {
  try {
    const [total, byStage, bySource, byTemp, byAssigned, overdue, thisMonth] = await Promise.all([
      queryOne('SELECT COUNT(*) as total, COALESCE(SUM(budget),0) as pipeline_value FROM leads'),
      query('SELECT stage, COUNT(*) as count, COALESCE(SUM(budget),0) as value FROM leads GROUP BY stage ORDER BY count DESC'),
      query('SELECT source, COUNT(*) as count FROM leads GROUP BY source ORDER BY count DESC LIMIT 10'),
      query('SELECT temperature, COUNT(*) as count FROM leads GROUP BY temperature'),
      query("SELECT assigned_to, COUNT(*) as count FROM leads WHERE assigned_to IS NOT NULL AND assigned_to != '' GROUP BY assigned_to ORDER BY count DESC LIMIT 10"),
      queryOne(`SELECT COUNT(*) as count FROM leads WHERE follow_up_date < CURRENT_DATE AND stage NOT IN ('Converted','Lost')`),
      queryOne(`SELECT COUNT(*) as count FROM leads WHERE created_at >= DATE_TRUNC('month', NOW())`),
    ]);
    const converted = byStage.find(s => s.stage === 'Converted');
    const totalCount = parseInt(total.total);
    const conversionRate = totalCount > 0 ? ((parseInt(converted?.count || 0) / totalCount) * 100).toFixed(1) : 0;
    res.json({
      success: true,
      stats: {
        total: totalCount,
        pipeline_value: parseFloat(total.pipeline_value),
        conversion_rate: parseFloat(conversionRate),
        overdue: parseInt(overdue.count),
        this_month: parseInt(thisMonth.count),
        by_stage: byStage,
        by_source: bySource,
        by_temperature: byTemp,
        by_assigned: byAssigned,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/leads/export — CSV download ─────────────────────────────────────
router.get('/api/leads/export', requireLogin, async (req, res, next) => {
  try {
    const { stage = '', temp = '', search = '' } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (stage)  { conditions.push(`stage = $${idx++}`);       params.push(stage); }
    if (temp)   { conditions.push(`temperature = $${idx++}`); params.push(temp); }
    if (search) { conditions.push(`(client_name ILIKE $${idx} OR phone ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const leads = await query(`SELECT lead_no, client_name, phone, destination, pax, budget, source, temperature, stage, assigned_to, follow_up_date, travel_date, notes, created_at FROM leads ${where} ORDER BY id DESC`, params);
    const headers = ['Lead#', 'Client', 'Phone', 'Destination', 'Pax', 'Budget', 'Source', 'Temperature', 'Stage', 'Assigned To', 'Follow-up Date', 'Travel Date', 'Notes', 'Created At'];
    const csvRows = [headers.join(',')];
    leads.forEach(l => {
      csvRows.push([
        l.lead_no, `"${(l.client_name || '').replace(/"/g, '""')}"`, l.phone || '',
        `"${(l.destination || '').replace(/"/g, '""')}"`, l.pax || '', l.budget || 0,
        l.source || '', l.temperature || '', l.stage || '', l.assigned_to || '',
        l.follow_up_date || '', l.travel_date || '',
        `"${(l.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : '',
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads_${Date.now()}.csv`);
    res.send(csvRows.join('\n'));
  } catch (err) { next(err); }
});

// ── GET /api/leads/get/:id ────────────────────────────────────────────────────
router.get('/api/leads/get/:id', requireLogin, async (req, res, next) => {
  try {
    const lead = await queryOne('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (err) { next(err); }
});

// ── GET /api/leads/activity/:id — get activity log ───────────────────────────
router.get('/api/leads/activity/:id', requireLogin, async (req, res, next) => {
  try {
    const activities = await query('SELECT * FROM lead_activities WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json({ success: true, activities });
  } catch (err) { next(err); }
});

// ── POST /api/leads/activity/:id — add activity note ─────────────────────────
router.post('/api/leads/activity/:id', requireLogin, async (req, res, next) => {
  try {
    const lead = await queryOne('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    // Graceful migration: add new columns if they don't exist
    await Promise.allSettled([
      query(`ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS outcome TEXT DEFAULT NULL`),
      query(`ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS next_follow_up DATE DEFAULT NULL`),
      query(`ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS duration_mins INTEGER DEFAULT NULL`),
      query(`ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS stage_updated_to TEXT DEFAULT NULL`),
    ]);

    const {
      action = 'Note',
      detail,
      outcome = null,
      next_follow_up = null,
      duration_mins = null,
      stage_updated_to = null,
    } = req.body;

    if (!detail && !outcome) return res.status(400).json({ success: false, error: 'detail or outcome required' });

    const rows = await query(
      `INSERT INTO lead_activities
        (lead_id, lead_no, action, detail, done_by, outcome, next_follow_up, duration_mins, stage_updated_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [lead.id, lead.lead_no, action, detail || '', req.session.user.name || req.session.user.email,
       outcome, next_follow_up || null, duration_mins || null, stage_updated_to || null]
    );

    // Side-effects: update lead fields if provided
    const leadUpdates = [];
    const leadParams = [];
    let pi = 1;

    if (next_follow_up) {
      leadUpdates.push(`follow_up_date=$${pi++}`);
      leadParams.push(next_follow_up);
    }
    if (stage_updated_to && stage_updated_to !== lead.stage) {
      leadUpdates.push(`stage=$${pi++}`);
      leadParams.push(stage_updated_to);
      await pushNotification(
        'Lead Stage Updated',
        `Lead ${lead.lead_no} — ${lead.client_name} moved to "${stage_updated_to}"`,
        'info', 'all'
      );
    }
    if (req.body.temperature && req.body.temperature !== lead.temperature) {
      leadUpdates.push(`temperature=$${pi++}`);
      leadParams.push(req.body.temperature);
    }
    if (leadUpdates.length) {
      leadParams.push(lead.id);
      await query(`UPDATE leads SET ${leadUpdates.join(', ')} WHERE id=$${pi}`, leadParams);
    }

    const updatedLead = await queryOne('SELECT * FROM leads WHERE id=$1', [lead.id]);
    res.json({ success: true, activity: rows[0], lead: updatedLead });
  } catch (err) { next(err); }
});

// ── POST /api/leads/add ───────────────────────────────────────────────────────
router.post('/api/leads/add', requireLogin, async (req, res, next) => {
  try {
    const lead_no = await nextLeadNo();
    const {
      client_name, phone, destination, pax = 1, budget = 0,
      source = 'WhatsApp', assigned_to, stage = 'New Enquiry',
      temperature = 'Warm', follow_up_date, travel_date, notes,
    } = req.body;
    const rows = await query(
      `INSERT INTO leads
        (lead_no, client_name, phone, destination, pax, budget, source, assigned_to,
         stage, temperature, follow_up_date, travel_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [lead_no, client_name, phone, destination, pax, budget, source, assigned_to,
       stage, temperature, follow_up_date, travel_date, notes]
    );
    const lead = rows[0];
    await logAudit('Created Lead', 'CRM', req.session.user.email, `New lead ${lead_no} created for ${client_name}`, req.ip);
    await pushNotification('New Lead Added', `Lead ${lead_no} — ${client_name} added`, 'info', 'all');
    // Log activity
    await query(
      'INSERT INTO lead_activities (lead_id, lead_no, action, detail, done_by) VALUES ($1,$2,$3,$4,$5)',
      [lead.id, lead.lead_no, 'Created', `Lead created — ${client_name} for ${destination || 'unknown'}`, req.session.user.name || req.session.user.email]
    );
    res.json({ success: true, lead });
  } catch (err) { next(err); }
});

// ── POST /api/leads/update/:id ────────────────────────────────────────────────
router.post('/api/leads/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Lead not found' });
    const merged = { ...existing, ...req.body };
    await query(
      `UPDATE leads SET
        client_name=$1, phone=$2, destination=$3, pax=$4, budget=$5,
        source=$6, assigned_to=$7, stage=$8, temperature=$9,
        follow_up_date=$10, travel_date=$11, notes=$12
       WHERE id=$13`,
      [merged.client_name, merged.phone, merged.destination, merged.pax, merged.budget,
       merged.source, merged.assigned_to, merged.stage, merged.temperature,
       merged.follow_up_date, merged.travel_date, merged.notes, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    await logAudit('Updated Lead', 'CRM', req.session.user.email, `Lead ${existing.lead_no} updated`, req.ip);
    // Log stage change activity
    if (req.body.stage && req.body.stage !== existing.stage) {
      await pushNotification('Lead Stage Changed', `Lead ${existing.lead_no} — ${existing.client_name} moved to "${req.body.stage}"`, 'info', 'all');
      await query(
        'INSERT INTO lead_activities (lead_id, lead_no, action, detail, done_by) VALUES ($1,$2,$3,$4,$5)',
        [existing.id, existing.lead_no, 'Stage Changed', `Stage changed from "${existing.stage}" to "${req.body.stage}"`, req.session.user.name || req.session.user.email]
      );
    }
    res.json({ success: true, lead: updated });
  } catch (err) { next(err); }
});

// ── POST /api/leads/bulk-update — bulk stage/assign ──────────────────────────
router.post('/api/leads/bulk-update', requireLogin, async (req, res, next) => {
  try {
    const { ids, stage, assigned_to, temperature } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const sets = [];
    const extraParams = [];
    let paramIdx = ids.length + 1;
    if (stage)       { sets.push(`stage = $${paramIdx++}`);       extraParams.push(stage); }
    if (assigned_to) { sets.push(`assigned_to = $${paramIdx++}`); extraParams.push(assigned_to); }
    if (temperature) { sets.push(`temperature = $${paramIdx++}`); extraParams.push(temperature); }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });
    await query(`UPDATE leads SET ${sets.join(', ')} WHERE id IN (${placeholders})`, [...ids, ...extraParams]);
    await logAudit('Bulk Updated Leads', 'CRM', req.session.user.email, `Bulk updated ${ids.length} leads`, req.ip);
    if (stage) await pushNotification('Leads Bulk Updated', `${ids.length} leads moved to "${stage}"`, 'info', 'all');
    res.json({ success: true, updated: ids.length });
  } catch (err) { next(err); }
});

// ── POST /api/leads/bulk-delete ───────────────────────────────────────────────
router.post('/api/leads/bulk-delete', requireLogin, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array required' });
    }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await query(`DELETE FROM leads WHERE id IN (${placeholders})`, ids);
    await logAudit('Bulk Deleted Leads', 'CRM', req.session.user.email, `Bulk deleted ${ids.length} leads`, req.ip);
    res.json({ success: true, deleted: ids.length });
  } catch (err) { next(err); }
});

// ── POST /api/leads/delete/:id ────────────────────────────────────────────────
router.post('/api/leads/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const lead = await queryOne('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    await query('DELETE FROM leads WHERE id=$1', [req.params.id]);
    await pushNotification('Lead Deleted', `Lead ${lead.lead_no} deleted`, 'warning', 'all');
    await logAudit('Deleted Lead', 'CRM', req.session.user.email, `Lead ${lead.lead_no} deleted`, req.ip);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /api/leads/convert/:id ───────────────────────────────────────────────
router.post('/api/leads/convert/:id', requireLogin, async (req, res, next) => {
  try {
    const lead = await queryOne('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    const booking_no = await nextBookingNo();
    await query(
      `INSERT INTO bookings (booking_no, client, phone, destination, pax, package_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [booking_no, lead.client_name, lead.phone, lead.destination, lead.pax, lead.budget, 'Confirmed']
    );
    await query("UPDATE leads SET stage='Converted' WHERE id=$1", [lead.id]);
    await pushNotification('Lead Converted', `Lead ${lead.lead_no} — ${lead.client_name} converted to Booking ${booking_no}`, 'success', 'all');
    await logAudit('Converted Lead to Booking', 'CRM', req.session.user.email, `Lead ${lead.lead_no} converted to ${booking_no}`, req.ip);
    // Log activity
    await query(
      'INSERT INTO lead_activities (lead_id, lead_no, action, detail, done_by) VALUES ($1,$2,$3,$4,$5)',
      [lead.id, lead.lead_no, 'Converted', `Converted to Booking ${booking_no}`, req.session.user.name || req.session.user.email]
    );
    res.json({ success: true, booking_no });
  } catch (err) { next(err); }
});

module.exports = router;
