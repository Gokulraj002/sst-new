'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { pushNotification } = require('../utils/notifications');

async function nextVoucherNo() {
  const row = await queryOne("SELECT voucher_no FROM vouchers WHERE voucher_no LIKE 'VCH-%' ORDER BY id DESC LIMIT 1");
  if (!row || !row.voucher_no) return 'VCH-001';
  const num = parseInt(row.voucher_no.split('-')[1], 10) + 1;
  return `VCH-${String(num).padStart(3, '0')}`;
}

router.get('/api/vouchers/list', requireLogin, async (req, res, next) => {
  try {
    const vouchers = await query('SELECT * FROM vouchers ORDER BY id DESC');
    res.json({ success: true, vouchers });
  } catch (err) { next(err); }
});

router.get('/api/vouchers/get/:id', requireLogin, async (req, res, next) => {
  try {
    const voucher = await queryOne('SELECT * FROM vouchers WHERE id=$1', [req.params.id]);
    if (!voucher) return res.status(404).json({ success: false, error: 'Voucher not found' });
    res.json({ success: true, voucher });
  } catch (err) { next(err); }
});

router.post('/api/vouchers/add', requireLogin, async (req, res, next) => {
  try {
    const voucher_no = await nextVoucherNo();
    const {
      voucher_type = 'Payment', party_name, amount = 0,
      narration, voucher_date, prepared_by, approved_by, status = 'Draft',
    } = req.body;
    const rows = await query(
      `INSERT INTO vouchers (voucher_no, voucher_type, party_name, amount, narration, voucher_date, prepared_by, approved_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [voucher_no, voucher_type, party_name, amount, narration, voucher_date, prepared_by, approved_by, status]
    );
    const voucher = rows[0];
    await logAudit('Created Voucher', 'Vouchers', req.session.user.email, `Voucher ${voucher_no} for ${party_name}`, req.ip);
    await pushNotification('Voucher Created', 'Voucher ' + voucher_no + ' for ' + party_name + ' created', 'info', 'all');
    res.json({ success: true, voucher });
  } catch (err) { next(err); }
});

router.post('/api/vouchers/update/:id', requireLogin, async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM vouchers WHERE id=$1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Voucher not found' });
    const m = { ...existing, ...req.body };
    await query(
      `UPDATE vouchers SET voucher_type=$1, party_name=$2, amount=$3, narration=$4,
       voucher_date=$5, prepared_by=$6, approved_by=$7, status=$8 WHERE id=$9`,
      [m.voucher_type, m.party_name, m.amount, m.narration,
       m.voucher_date, m.prepared_by, m.approved_by, m.status, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM vouchers WHERE id=$1', [req.params.id]);
    await logAudit('Updated Voucher', 'Vouchers', req.session.user.email, `Voucher ${existing.voucher_no} updated`, req.ip);
    res.json({ success: true, voucher: updated });
  } catch (err) { next(err); }
});

router.post('/api/vouchers/delete/:id', requireLogin, async (req, res, next) => {
  try {
    const voucher = await queryOne('SELECT * FROM vouchers WHERE id=$1', [req.params.id]);
    if (!voucher) return res.status(404).json({ success: false, error: 'Voucher not found' });
    await query('DELETE FROM vouchers WHERE id=$1', [req.params.id]);
    await logAudit('Deleted Voucher', 'Vouchers', req.session.user.email, `Voucher ${voucher.voucher_no} deleted`, req.ip);
    await pushNotification('Voucher Deleted', 'Voucher ' + voucher.voucher_no + ' deleted', 'warning', 'all');
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
