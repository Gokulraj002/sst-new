'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// GET /api/reports/summary
router.get('/api/reports/summary', requireLogin, async (req, res, next) => {
  try {
    // ── KPI queries ───────────────────────────────────────────────────────────
    const [revenueRow, bookingsRow, leadsRow, convertedRow, paxRow, pendingRow] = await Promise.all([
      queryOne('SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings'),
      queryOne('SELECT COUNT(*) AS v FROM bookings'),
      queryOne("SELECT COUNT(*) AS v FROM leads WHERE stage NOT IN ('Converted','Lost')"),
      queryOne("SELECT COUNT(*) AS v FROM leads WHERE stage='Converted'"),
      queryOne('SELECT COALESCE(SUM(pax),0) AS v FROM bookings'),
      queryOne("SELECT COALESCE(SUM(amount - paid),0) AS v FROM invoices WHERE status IN ('Unpaid','Partial')"),
    ]);

    const total_leads = leadsRow.v;
    const converted = convertedRow.v;
    const total_leads_all = total_leads + converted;
    const conversion_rate = total_leads_all > 0 ? parseFloat(((converted / total_leads_all) * 100).toFixed(1)) : 0;

    const kpis = {
      total_revenue: revenueRow.v,
      bookings_count: bookingsRow.v,
      leads_count: total_leads,
      conversion_rate,
      total_pax: paxRow.v,
      pending_payments: Math.max(0, pendingRow.v),
    };

    // ── Last 6 months ─────────────────────────────────────────────────────────
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      });
    }

    const monthlyRows = await Promise.all(
      months.map(async ({ label, yearMonth }) => {
        const [bookRow, collRow, domRow, intRow, cntRow] = await Promise.all([
          queryOne(
            "SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings WHERE TO_CHAR(created_at,'YYYY-MM')=$1",
            [yearMonth]
          ),
          queryOne(
            "SELECT COALESCE(SUM(advance_paid),0) AS v FROM bookings WHERE TO_CHAR(created_at,'YYYY-MM')=$1",
            [yearMonth]
          ),
          queryOne(
            "SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings WHERE TO_CHAR(created_at,'YYYY-MM')=$1 AND tour_type IN ('Domestic','FIT')",
            [yearMonth]
          ),
          queryOne(
            "SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings WHERE TO_CHAR(created_at,'YYYY-MM')=$1 AND tour_type IN ('International','MICE','Corporate','Honeymoon')",
            [yearMonth]
          ),
          queryOne(
            "SELECT COUNT(*) AS v FROM bookings WHERE TO_CHAR(created_at,'YYYY-MM')=$1",
            [yearMonth]
          ),
        ]);
        return {
          label,
          yearMonth,
          revenue: parseFloat((bookRow.v / 100000).toFixed(2)),
          collection: parseFloat((collRow.v / 100000).toFixed(2)),
          domestic: parseFloat((domRow.v / 100000).toFixed(2)),
          international: parseFloat((intRow.v / 100000).toFixed(2)),
          raw_revenue: bookRow.v,
          raw_collection: collRow.v,
          bookings_count: parseInt(cntRow.v, 10),
        };
      })
    );

    // ── Lead sources ──────────────────────────────────────────────────────────
    const leadSourceRows = await query(
      "SELECT source, COUNT(*) AS count FROM leads WHERE source IS NOT NULL GROUP BY source ORDER BY count DESC LIMIT 8"
    );

    // ── Top destinations ──────────────────────────────────────────────────────
    const topDestRows = await query(
      `SELECT destination, COUNT(*) AS bookings, COALESCE(SUM(package_amount),0) AS revenue
       FROM bookings WHERE destination IS NOT NULL
       GROUP BY destination ORDER BY bookings DESC LIMIT 6`
    );

    // ── Lead pipeline ─────────────────────────────────────────────────────────
    const pipelineRows = await query(
      'SELECT stage, COUNT(*) AS count, COALESCE(SUM(budget),0) AS value FROM leads WHERE stage IS NOT NULL GROUP BY stage ORDER BY count DESC'
    );
    const totalLeadCount = pipelineRows.reduce((s, r) => s + parseInt(r.count, 10), 0);
    const pipelineWithPct = pipelineRows.map((r) => ({
      ...r,
      count: parseInt(r.count, 10),
      value: parseFloat(r.value),
      pct: totalLeadCount > 0 ? Math.round((parseInt(r.count, 10) / totalLeadCount) * 100) : 0,
    }));
    const pipelineObj = {};
    pipelineWithPct.forEach((r) => { pipelineObj[r.stage] = r.count; });

    // ── Recent bookings ───────────────────────────────────────────────────────
    const recent_bookings = await query(
      'SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10'
    );

    res.json({
      success: true,
      kpis,
      chart_data: {
        revenue: {
          labels: monthlyRows.map((m) => m.label),
          domestic: monthlyRows.map((m) => m.domestic),
          international: monthlyRows.map((m) => m.international),
        },
        lead_sources: {
          labels: leadSourceRows.map((r) => r.source),
          data: leadSourceRows.map((r) => r.count),
        },
        top_destinations: {
          labels: topDestRows.map((r) => r.destination),
          data: topDestRows.map((r) => r.bookings),
        },
        finance: {
          labels: monthlyRows.map((m) => m.label),
          revenue: monthlyRows.map((m) => m.revenue),
          collection: monthlyRows.map((m) => m.collection),
        },
        pipeline: pipelineObj,
      },
      tables: {
        monthly_revenue: monthlyRows.map((m) => ({ month: m.label, bookings: m.bookings_count, revenue: m.raw_revenue, collections: m.raw_collection })),
        top_destinations: topDestRows,
        lead_pipeline: pipelineWithPct,
        recent_bookings,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
