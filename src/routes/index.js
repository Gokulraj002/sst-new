'use strict';

const router = require('express').Router();

router.use('/', require('./auth'));
router.use('/', require('./leads'));
router.use('/', require('./quotations'));
router.use('/', require('./bookings'));
router.use('/', require('./tasks'));
router.use('/', require('./visa'));
router.use('/', require('./invoices'));
router.use('/', require('./employees'));
router.use('/', require('./users'));
router.use('/', require('./expenses'));
router.use('/', require('./vouchers'));
router.use('/', require('./refunds'));
router.use('/', require('./customers'));
router.use('/', require('./commissions'));
router.use('/', require('./approvals'));
router.use('/', require('./vendorpay'));
router.use('/', require('./inventory'));
router.use('/', require('./documents'));
router.use('/', require('./vendors'));
router.use('/', require('./itineraries'));
router.use('/', require('./notifications'));
router.use('/', require('./audit'));
router.use('/', require('./dashboard'));
router.use('/', require('./reports'));
router.use('/', require('./pnl'));
router.use('/', require('./settings'));

module.exports = router;
