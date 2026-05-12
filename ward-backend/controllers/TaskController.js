const express = require('express');
const router = express.Router();
const taskService = require('../services/TaskService');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize, authorizeAny } = require('../middleware/rbac');
const { requireTenantTask } = require('../middleware/tenant');
const { adminWriteLimiter } = require('../middleware/rateLimiters');

// GET /api/tasks/my
router.get('/my', authenticateToken, authorize(PERMISSIONS.READ_PATIENT), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const { limit, cursor } = req.query;
    const tasks = await taskService.listMyOpenTasks(req.user.name, tenantId, { limit, cursor });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tasks/:taskId/complete
router.put('/:taskId/complete', authenticateToken, adminWriteLimiter, authorizeAny([PERMISSIONS.WRITE_TASKS]), requireTenantTask('taskId'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await taskService.completeTask(req.params.taskId, req.user.name, tenantId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
