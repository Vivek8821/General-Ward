const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/protect');
const hl7Service = require('../services/hl7/index');
const orphanRepo = require('../repositories/Hl7OrphanRepository');
const dbAdapter = require('../db-adapter');

const isAdmin  = (req) => req.user?.role === 'admin';
const isReader = (req) => ['admin', 'doctor', 'nurse'].includes(req.user?.role);

// GET /api/hl7/status — MLLP server status and connected device list.
router.get('/status',
  protect(isAdmin, { resource: 'hl7.status' }),
  (req, res) => {
    res.json(hl7Service.getStatus());
  }
);

// GET /api/hl7/messages?limit=50 — recent processed inbound messages.
router.get('/messages',
  protect(isAdmin, { resource: 'hl7.messages' }),
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const rows = await dbAdapter.query(
        `SELECT id, messageId, messageType, sendingApp, sendingFacility, patientId, labRecordId, status, receivedAt, processedAt
           FROM Hl7InboundMessages
          WHERE tenantId = ?
          ORDER BY receivedAt DESC
          LIMIT ?`,
        [req.tenantId, limit]
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

// GET /api/hl7/orphans — messages that could not be matched to a patient.
router.get('/orphans',
  protect(isAdmin, { resource: 'hl7.orphans' }),
  async (req, res, next) => {
    try {
      const rows = await orphanRepo.listPending(req.tenantId);
      res.json({ data: rows });
    } catch (err) { next(err); }
  }
);

// POST /api/hl7/orphans/:id/link — link an orphan to a patient by patientId.
router.post('/orphans/:id/link',
  protect(isAdmin, { resource: 'hl7.orphans' }),
  async (req, res, next) => {
    try {
      const { patientId } = req.body || {};
      if (!patientId) return res.status(400).json({ error: 'patientId required' });

      const orphan = await orphanRepo.findById(req.params.id, req.tenantId);
      if (!orphan) return res.status(404).json({ error: 'Orphan not found' });
      if (orphan.linkedPatientId) return res.status(409).json({ error: 'Already linked' });

      const updated = await orphanRepo.linkToPatient(req.params.id, req.tenantId, patientId, req.user.id);
      res.json(updated);
    } catch (err) { next(err); }
  }
);

module.exports = router;
