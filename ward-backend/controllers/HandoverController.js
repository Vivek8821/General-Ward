const express = require('express');
const router = express.Router({ mergeParams: true });
const handoverNotesService = require('../services/HandoverNotesService');
const taskService = require('../services/TaskService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');

// POST /api/patients/:patientId/notes
router.post('/notes', authenticateToken, authorizeAny([PERMISSIONS.WRITE_NOTES]), requireTenantPatient('patientId'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await handoverNotesService.createNote(req.params.patientId, req.body, req.user.name, tenantId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// GET /api/patients/:patientId/notes
router.get('/notes', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await handoverNotesService.listNotes(req.params.patientId, tenantId, req.query);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// POST /api/patients/:patientId/tasks
router.post('/tasks', authenticateToken, authorizeAny([PERMISSIONS.WRITE_TASKS]), requireTenantPatient('patientId'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await taskService.createTask(req.params.patientId, req.body, req.user.name, tenantId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// GET /api/patients/:patientId/tasks
router.get('/tasks', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('patientId'), async (req, res) => {
  try {
    const { status = 'open', limit, cursor } = req.query;
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await taskService.listPatientTasks(req.params.patientId, status, tenantId, { limit, cursor });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;
