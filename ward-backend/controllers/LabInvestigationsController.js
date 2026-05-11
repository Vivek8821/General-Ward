const express = require('express');
const router = express.Router({ mergeParams: true });
const labRepo = require('../repositories/LabInvestigationRepository');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');

function validate(body) {
  if (!body.investigationDate) return 'investigationDate is required';
  if (isNaN(new Date(body.investigationDate).getTime())) return 'investigationDate is invalid';
  if (!body.results) return 'results is required';
  return null;
}

router.get('/:id/labs',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      res.json(await labRepo.getByPatient(req.params.id, tenantId));
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.post('/:id/labs',
  authenticateToken, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await labRepo.create({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        recordedBy: req.body.recordedBy || req.user.name,
      });
      res.status(201).json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/labs/:labId',
  authenticateToken, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await labRepo.update(req.params.labId, tenantId, {
        ...req.body,
        recordedBy: req.body.recordedBy || req.user.name,
      });
      if (!result) return res.status(404).json({ error: 'Lab record not found' });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.delete('/:id/labs/:labId',
  authenticateToken, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      await labRepo.delete(req.params.labId, tenantId);
      res.status(204).end();
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
