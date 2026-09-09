const express = require('express');
const { requirePractitionerAuth } = require('../middleware/requirePractitionerAuth');
const {
  getDashboardSummary,
  listDashboardOrders,
  getDashboardOrderDetail,
  buildEarningsCsv,
} = require('../services/dashboard.service');

const router = express.Router();

router.use(requirePractitionerAuth);

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getDashboardSummary(req.practitioner.id, req.query);
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const result = await listDashboardOrders(req.practitioner.id, req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await getDashboardOrderDetail(
      req.practitioner.id,
      req.params.id
    );
    return res.json(order);
  } catch (error) {
    return next(error);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const csv = await buildEarningsCsv(req.practitioner.id, req.query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="practitioner-earnings.csv"'
    );
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
