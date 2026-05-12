const express = require('express');
const router = express.Router({ mergeParams: true });
const presentationRepo = require('../repositories/ClinicalPresentationRepository');
const { validateClinicalPresentation, bad } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter } = require('../middleware/rateLimiters');

router.get('/:id/presentation',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      res.json(await presentationRepo.getByPatient(req.params.id, tenantId) || {});
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/presentation',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const errors = validateClinicalPresentation(req.body || {});
    if (errors.length > 0) return bad(res, errors);

    try {
      const tenantId = req.tenantId;
      const result = await presentationRepo.upsert({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        examinedBy: req.body.examinedBy || req.user.name,
      });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
