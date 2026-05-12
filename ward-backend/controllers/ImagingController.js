const express = require('express');
const router = express.Router({ mergeParams: true });
const imagingRepo = require('../repositories/ImagingReportRepository');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter } = require('../middleware/rateLimiters');

const VALID_MODALITIES = ['ecg', 'xray', 'usg', 'ct', 'mri', 'pet', 'echo', 'spirometry', 'other'];

function validate(body) {
  if (!VALID_MODALITIES.includes(body.modalityType))
    return `modalityType must be one of: ${VALID_MODALITIES.join(', ')}`;
  if (!body.investigationDate) return 'investigationDate is required';
  if (isNaN(new Date(body.investigationDate).getTime())) return 'investigationDate is invalid';
  if (!body.findings) return 'findings is required';
  return null;
}

router.get('/:id/imaging',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      res.json(await imagingRepo.getByPatient(req.params.id, tenantId));
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.post('/:id/imaging',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.tenantId;
      const result = await imagingRepo.create({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        reportedBy: req.body.reportedBy || req.user.name,
      });
      res.status(201).json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/imaging/:imagingId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.tenantId;
      const result = await imagingRepo.update(req.params.imagingId, req.params.id, tenantId, {
        ...req.body,
        reportedBy: req.body.reportedBy || req.user.name,
      });
      if (!result) return res.status(404).json({ error: 'Imaging record not found' });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.delete('/:id/imaging/:imagingId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      await imagingRepo.delete(req.params.imagingId, req.params.id, tenantId);
      res.status(204).end();
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
