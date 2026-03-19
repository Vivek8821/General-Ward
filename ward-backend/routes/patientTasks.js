const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireRole } = require('../middleware/auth');
const taskService = require('../services/TaskService');

// POST /api/patients/:patientId/tasks
router.post('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await taskService.createTask(req.params.patientId, req.body, req.user.name, tenantId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'VALIDATION_ERROR'
    });
  }
});

// GET /api/patients/:patientId/tasks?status=open|completed|cancelled
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    const tasks = await taskService.listPatientTasks(req.params.patientId, status);
    res.json(tasks);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: 'VALIDATION_ERROR'
    });
  }
});

module.exports = router;

