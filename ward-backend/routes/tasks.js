const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const taskService = require('../services/TaskService');

// GET /api/tasks/my - cross-patient tasks for the current user
router.get('/my', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const tasks = await taskService.listMyOpenTasks(req.user.name);
    res.json(tasks);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// PUT /api/tasks/:taskId/complete
router.put('/:taskId/complete', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const result = await taskService.completeTask(req.params.taskId, req.user.name);
    res.json(result);
  } catch (error) {
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;

