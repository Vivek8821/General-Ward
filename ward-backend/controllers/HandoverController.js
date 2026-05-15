const express = require('express');
const router = express.Router({ mergeParams: true });
const handoverNotesService = require('../services/HandoverNotesService');
const taskService = require('../services/TaskService');
const { validateHandoverNote, validateTask, bad } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter, adminWriteLimiter } = require('../middleware/rateLimiters');
const { safeAccrueConsultation } = require('../services/billing/AccrualService');

// POST /api/patients/:patientId/notes
router.post('/notes', authenticateToken, clinicalWriteLimiter, authorizeAny([PERMISSIONS.WRITE_NOTES]), requireTenantPatient('patientId'), async (req, res, next) => {
  const errors = validateHandoverNote(req.body || {});
  if (errors.length > 0) return bad(res, errors);

  try {
    const tenantId = req.tenantId;
    const result = await handoverNotesService.createNote(req.params.patientId, req.body, req.user.name, tenantId);

    // Auto-charge consultation fee on a doctor's first note for this patient today.
    // Idempotent on (doctorId, patientId, YYYY-MM-DD); subsequent same-day notes do nothing.
    if (req.user.role === 'doctor') {
      await safeAccrueConsultation({
        patientId: req.params.patientId,
        tenantId,
        doctorId: req.user.id,
      });
    }

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/patients/:patientId/notes
router.get('/notes', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const result = await handoverNotesService.listNotes(req.params.patientId, tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/patients/:patientId/tasks
router.post('/tasks', authenticateToken, clinicalWriteLimiter, authorizeAny([PERMISSIONS.WRITE_TASKS]), requireTenantPatient('patientId'), async (req, res, next) => {
  const errors = validateTask(req.body || {});
  if (errors.length > 0) return bad(res, errors);

  try {
    const tenantId = req.tenantId;
    const result = await taskService.createTask(req.params.patientId, req.body, req.user.name, tenantId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/patients/:patientId/tasks
router.get('/tasks', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res, next) => {
  try {
    const { status = 'open', limit, cursor } = req.query;
    const tenantId = req.tenantId;
    const result = await taskService.listPatientTasks(req.params.patientId, status, tenantId, { limit, cursor });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
