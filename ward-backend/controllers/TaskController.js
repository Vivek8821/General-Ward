const express = require('express');
const router = express.Router();
const taskService = require('../services/TaskService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantTask } = require('../middleware/tenant');

// GET /api/tasks/my
router.get('/my', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const { limit, cursor } = req.query;
    const tasks = await taskService.listMyOpenTasks(req.user.name, tenantId, { limit, cursor });
    res.json(tasks);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// PUT /api/tasks/:taskId/complete
router.put('/:taskId/complete', authenticateToken, authorizeAny([PERMISSIONS.WRITE_TASKS]), requireTenantTask('taskId'), async (req, res) => {
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
