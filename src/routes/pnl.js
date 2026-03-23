'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// GET /api/pnl/summary
router.get('/api/pnl/summary', requireLogin, async (req, res, next) => {
  try {
    const [revenueRow, vendorPaidRow, expApprRow, pendingRow] = await Promise.all([
      queryOne("SELECT COALESCE(SUM(paid),0) AS v FROM invoices WHERE status IN ('Paid','Partial')"),
      queryOne("SELECT COALESCE(SUM(amount),0) AS v FROM vendor_payments WHERE status='Paid'"),
      queryOne("SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE status='Approved'"),
      queryOne("SELECT COALESCE(SUM(amount - paid),0) AS v FROM invoices WHERE status IN ('Unpaid','Partial')"),
    ]);

    const revenue = revenueRow.v;
    const payables = vendorPaidRow.v;
    const expenses = expApprRow.v;
    const pending = pendingRow.v;
    const profit = revenue - payables - expenses;

    // Last 6 months data
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      });
    }

    const monthly = await Promise.all(
      months.map(async ({ label, yearMonth }) => {
        const [revRow, expRow, vendRow] = await Promise.all([
          queryOne(
            "SELECT COALESCE(SUM(paid),0) AS v FROM invoices WHERE TO_CHAR(created_at,'YYYY-MM')=$1",
            [yearMonth]
          ),
          queryOne(
            "SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE status='Approved' AND TO_CHAR(created_at,'YYYY-MM')=$1",
            [yearMonth]
          ),
          queryOne(
            "SELECT COALESCE(SUM(amount),0) AS v FROM vendor_payments WHERE status='Paid' AND TO_CHAR(created_at,'YYYY-MM')=$1",
            [yearMonth]
          ),
        ]);
        const rev = revRow.v;
        const exp = expRow.v + vendRow.v;
        return {
          month: label,
          revenue: parseFloat((rev / 100000).toFixed(2)),
          expenses: parseFloat((exp / 100000).toFixed(2)),
          profit: parseFloat(((rev - exp) / 100000).toFixed(2)),
        };
      })
    );

    res.json({
      success: true,
      revenue,
      payables,
      expenses,
      profit,
      pending,
      monthly,
    });
  } catch (err) { next(err); }
});

module.exports = router;
