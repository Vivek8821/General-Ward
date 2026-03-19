const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireRole } = require('../middleware/auth');
const handoverNotesService = require('../services/HandoverNotesService');

// POST /api/patients/:patientId/notes
router.post('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-default';
    const result = await handoverNotesService.createNote(req.params.patientId, req.body, req.user.name, tenantId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// GET /api/patients/:patientId/notes?shift=morning|afternoon|night&from=...&to=...&limit=...
router.get('/', authenticateToken, requireRole(['doctor', 'nurse', 'admin']), async (req, res) => {
  try {
    const tasks = await handoverNotesService.listNotes(req.params.patientId, req.query);
    res.json(tasks);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

module.exports = router;

