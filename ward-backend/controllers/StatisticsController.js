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

const VALID_PERIODS = ['week', 'month', 'quarter', 'year'];

function validateFilters(query) {
  const filters = {};

  if (query.period !== undefined && !VALID_PERIODS.includes(query.period)) {
    return { error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}` };
  }

  if (query.ageMin !== undefined && query.ageMin !== '') {
    const v = parseInt(query.ageMin, 10);
    if (isNaN(v) || v < 0 || v > 150) return { error: 'ageMin must be an integer between 0 and 150' };
    filters.ageMin = v;
  }
  if (query.ageMax !== undefined && query.ageMax !== '') {
    const v = parseInt(query.ageMax, 10);
    if (isNaN(v) || v < 0 || v > 150) return { error: 'ageMax must be an integer between 0 and 150' };
    filters.ageMax = v;
  }
  if (filters.ageMin !== undefined && filters.ageMax !== undefined && filters.ageMin > filters.ageMax) {
    return { error: 'ageMin must not be greater than ageMax' };
  }

  if (query.from) {
    if (isNaN(new Date(query.from).getTime())) return { error: 'Invalid from date' };
    filters.from = query.from;
  }
  if (query.to) {
    if (isNaN(new Date(query.to).getTime())) return { error: 'Invalid to date' };
    filters.to = query.to;
  }

  if (query.residence) filters.residence = String(query.residence).slice(0, 100);
  if (query.gender) filters.gender = String(query.gender).slice(0, 50);
  if (query.disease) filters.disease = String(query.disease).slice(0, 100);

  return { filters };
}

router.get('/summary', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const { filters, error } = validateFilters(req.query);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
    const result = await statisticsService.getSummary(tenantId, req.query.period, filters);
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/diseases', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const { filters, error } = validateFilters(req.query);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
    const result = await statisticsService.getDiseaseDistribution(tenantId, req.query.period, filters);
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/demographics', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const { filters, error } = validateFilters(req.query);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
    const result = await statisticsService.getDemographicBreakdown(tenantId, req.query.period, filters);
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/medications', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const { filters, error } = validateFilters(req.query);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
    const result = await statisticsService.getMedicationStats(tenantId, req.query.period, filters);
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/admissions', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const { filters, error } = validateFilters(req.query);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
    const result = await statisticsService.getAdmissionTrend(tenantId, req.query.period, filters);
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

router.get('/outcomes', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const { filters, error } = validateFilters(req.query);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
    const result = await statisticsService.getClinicalOutcomes(tenantId, req.query.period, filters);
    res.json(result);
  } catch (err) {
    err.status = 500;
    next(err);
  }
});

const statisticsReportService = require('../services/StatisticsReportService');

router.post('/report', authenticateToken, authorize(PERMISSIONS.VIEW_STATISTICS), statsLimiter, async (req, res, next) => {
  const body = req.body || {};
  const period = VALID_PERIODS.includes(body.period) ? body.period : 'month';
  const { filters, error } = validateFilters(body);
  if (error) return res.status(400).json({ error });
  try {
    const tenantId = req.tenantId;
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
