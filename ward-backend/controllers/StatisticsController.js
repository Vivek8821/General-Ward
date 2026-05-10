const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const statisticsService = require('../services/StatisticsService');

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many statistics requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function parseFilters(query) {
  const filters = {};
  if (query.residence) filters.residence = query.residence;
  if (query.gender) filters.gender = query.gender;
  if (query.ageMin != null && query.ageMin !== '') filters.ageMin = query.ageMin;
  if (query.ageMax != null && query.ageMax !== '') filters.ageMax = query.ageMax;
  if (query.disease) filters.disease = query.disease;
  if (query.from) filters.from = query.from;
  if (query.to) filters.to = query.to;
  return filters;
}

router.get('/summary', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await statisticsService.getSummary(tenantId, req.query.period, parseFilters(req.query));
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/diseases', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await statisticsService.getDiseaseDistribution(tenantId, req.query.period, parseFilters(req.query));
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/demographics', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await statisticsService.getDemographicBreakdown(tenantId, req.query.period, parseFilters(req.query));
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/medications', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await statisticsService.getMedicationStats(tenantId, req.query.period, parseFilters(req.query));
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/admissions', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await statisticsService.getAdmissionTrend(tenantId, req.query.period, parseFilters(req.query));
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/outcomes', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await statisticsService.getClinicalOutcomes(tenantId, req.query.period, parseFilters(req.query));
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

const statisticsReportService = require('../services/StatisticsReportService');

router.post('/report', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const period = req.body?.period || 'month';
    const filters = parseFilters(req.body || {});
    const pdfBuffer = await statisticsReportService.generateReport(tenantId, period, filters);
    const periodLabel = period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : period === 'quarter' ? 'Quarterly' : 'Yearly';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Hospital-${periodLabel}-Statistics-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

module.exports = router;
