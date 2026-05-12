const express = require('express');
const router = express.Router({ mergeParams: true });
const procedureRepo = require('../repositories/ClinicalProcedureRepository');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter } = require('../middleware/rateLimiters');

function validate(body) {
  if (!body.procedureDate) return 'procedureDate is required';
  if (isNaN(new Date(body.procedureDate).getTime())) return 'procedureDate is invalid';
  if (!body.procedureName || typeof body.procedureName !== 'string') return 'procedureName is required';
  return null;
}

router.get('/:id/procedures',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      res.json(await procedureRepo.getByPatient(req.params.id, tenantId));
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.post('/:id/procedures',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.tenantId;
      const result = await procedureRepo.create({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        performedBy: req.body.performedBy || req.user.name,
      });
      res.status(201).json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/procedures/:procedureId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.tenantId;
      const result = await procedureRepo.update(req.params.procedureId, req.params.id, tenantId, {
        ...req.body,
        performedBy: req.body.performedBy || req.user.name,
      });
      if (!result) return res.status(404).json({ error: 'Procedure record not found' });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.delete('/:id/procedures/:procedureId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      await procedureRepo.delete(req.params.procedureId, req.params.id, tenantId);
      res.status(204).end();
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
