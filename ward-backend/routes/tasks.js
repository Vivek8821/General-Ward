const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const taskService = require('../services/TaskService');
const { requireTenantTask } = require('../middleware/tenant');

// GET /api/tasks/my - cross-patient tasks for the current user
router.get('/my', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const tasks = await taskService.listMyOpenTasks(req.user.name, tenantId);
    res.json(tasks);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// PUT /api/tasks/:taskId/complete
router.put('/:taskId/complete', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), requireTenantTask('taskId'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await taskService.completeTask(req.params.taskId, req.user.name, tenantId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;

