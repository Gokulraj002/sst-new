'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');

async function buildDashboard() {
  const today = new Date().toISOString().split('T')[0];

  // ── KPIs ──────────────────────────────────────────────────────────────
  const [
    totalRevenueRow, leadsRow, bookingsRow, pendingPayRow,
    totalPaxRow, hotLeadsRow, pendingQuotesRow, overdueTasksRow,
    visaExpiringRow,
  ] = await Promise.all([
    queryOne('SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings'),
    queryOne('SELECT COUNT(*) AS v FROM leads'),
    queryOne("SELECT COUNT(*) AS v FROM bookings WHERE status='Confirmed'"),
    queryOne("SELECT COALESCE(SUM(amount-paid),0) AS v FROM invoices WHERE status!='Paid'"),
    queryOne('SELECT COALESCE(SUM(pax),0) AS v FROM bookings'),
    queryOne("SELECT COUNT(*) AS v FROM leads WHERE temperature='Hot'"),
    queryOne("SELECT COUNT(*) AS v FROM quotations WHERE status='Awaiting'"),
    queryOne(`SELECT COUNT(*) AS v FROM tasks WHERE status='Pending' AND due_date < '${today}'`),
    queryOne(
      "SELECT COUNT(*) AS v FROM visa_applications WHERE expected_by <= (CURRENT_DATE + INTERVAL '5 days')::TEXT AND status NOT IN ('Approved','Not Required')"
    ),
  ]);

  // ── Finance KPIs ──────────────────────────────────────────────────────
  const [totalPaidRow, totalVendorPaidRow, totalExpApprRow] = await Promise.all([
    queryOne('SELECT COALESCE(SUM(paid),0) AS v FROM invoices'),
    queryOne("SELECT COALESCE(SUM(amount),0) AS v FROM vendor_payments WHERE status='Paid'"),
    queryOne("SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE status='Approved'"),
  ]);
  const totalPaid = totalPaidRow.v;
  const totalPayables = totalVendorPaidRow.v + totalExpApprRow.v;

  const kpis = {
    total_revenue: totalRevenueRow.v,
    leads_count: leadsRow.v,
    bookings_count: bookingsRow.v,
    pending_payments: pendingPayRow.v,
    total_pax: totalPaxRow.v,
    hot_leads: hotLeadsRow.v,
    pending_quotes: pendingQuotesRow.v,
    overdue_tasks: overdueTasksRow.v,
    visa_expiring: visaExpiringRow.v,
    // Finance summary
    revenue_collected: totalPaid,
    total_payables: totalPayables,
    net_profit: Math.max(0, totalPaid - totalPayables),
    pending_invoices: pendingPayRow.v,
  };

  // ── Monthly Revenue Chart (FY Apr 2025 – Mar 2026) ──────────────────
  const fyMonths = [
    { label: 'Apr', year: 2025, month: 4 },
    { label: 'May', year: 2025, month: 5 },
    { label: 'Jun', year: 2025, month: 6 },
    { label: 'Jul', year: 2025, month: 7 },
    { label: 'Aug', year: 2025, month: 8 },
    { label: 'Sep', year: 2025, month: 9 },
    { label: 'Oct', year: 2025, month: 10 },
    { label: 'Nov', year: 2025, month: 11 },
    { label: 'Dec', year: 2025, month: 12 },
    { label: 'Jan', year: 2026, month: 1 },
    { label: 'Feb', year: 2026, month: 2 },
    { label: 'Mar', year: 2026, month: 3 },
  ];

  const revenueLabels = [];
  const revenueDomestic = [];
  const revenueInternational = [];

  for (const { label, year, month } of fyMonths) {
    const mm = String(month).padStart(2, '0');
    const yearMonth = `${year}-${mm}`;
    revenueLabels.push(label);

    const [domRow, intRow] = await Promise.all([
      queryOne(
        `SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings
         WHERE TO_CHAR(created_at,'YYYY-MM')=$1
           AND tour_type NOT IN ('International','International FIT','International Group')`,
        [yearMonth]
      ),
      queryOne(
        `SELECT COALESCE(SUM(package_amount),0) AS v FROM bookings
         WHERE TO_CHAR(created_at,'YYYY-MM')=$1
           AND tour_type IN ('International','International FIT','International Group')`,
        [yearMonth]
      ),
    ]);
    revenueDomestic.push(domRow.v);
    revenueInternational.push(intRow.v);
  }

  // ── Lead Sources ──────────────────────────────────────────────────────
  const sourceRows = await query(
    `SELECT source, COUNT(*) AS count FROM leads
     WHERE source IS NOT NULL
     GROUP BY source ORDER BY count DESC LIMIT 8`
  );

  // ── Top Destinations ──────────────────────────────────────────────────
  const destRows = await query(
    `SELECT destination, COUNT(*) AS count FROM bookings
     WHERE destination IS NOT NULL
     GROUP BY destination ORDER BY count DESC LIMIT 6`
  );

  // ── Pipeline by stage ─────────────────────────────────────────────────
  const pipelineRows = await query(
    `SELECT stage, COUNT(*) AS count FROM leads
     WHERE stage IS NOT NULL
     GROUP BY stage ORDER BY count DESC`
  );
  const pipelineLabels = pipelineRows.map((r) => r.stage);
  const pipelineData = pipelineRows.map((r) => r.count);

  // ── Upcoming Bookings (next 14 days) ──────────────────────────────────
  const upcomingBookings = await query(
    `SELECT * FROM bookings
     WHERE depart_date >= $1
       AND depart_date <= (CURRENT_DATE + INTERVAL '14 days')::TEXT
     ORDER BY depart_date LIMIT 10`,
    [today]
  );

  // ── Pending Tasks (top 4) ─────────────────────────────────────────────
  const pendingTasks = await query(
    `SELECT * FROM tasks WHERE status != 'Done' ORDER BY due_date ASC LIMIT 4`
  );

  // ── Recent Leads ──────────────────────────────────────────────────────
  const leads = await query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 6');

  return {
    kpis,
    charts: {
      revenue: {
        labels: revenueLabels,
        domestic: revenueDomestic,
        international: revenueInternational,
      },
      lead_sources: {
        labels: sourceRows.map((r) => r.source),
        data: sourceRows.map((r) => r.count),
      },
      top_destinations: {
        labels: destRows.map((r) => r.destination),
        data: destRows.map((r) => r.count),
      },
      pipeline: {
        labels: pipelineLabels,
        data: pipelineData,
      },
    },
    upcoming_bookings: upcomingBookings,
    pending_tasks: pendingTasks,
    leads,
  };
}

// GET /api/dashboard/stats
router.get('/api/dashboard/stats', requireLogin, async (req, res, next) => {
  try {
    const data = await buildDashboard();
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

// GET /api/dashboard (alias)
router.get('/api/dashboard', requireLogin, async (req, res, next) => {
  try {
    const data = await buildDashboard();
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

module.exports = router;
