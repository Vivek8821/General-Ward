const express = require('express');
const router = express.Router({ mergeParams: true });
const toxRepo = require('../repositories/ToxicologyScreenRepository');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter } = require('../middleware/rateLimiters');

function validate(body) {
  if (!body.screenDate) return 'screenDate is required';
  if (isNaN(new Date(body.screenDate).getTime())) return 'screenDate is invalid';
  return null;
}

router.get('/:id/toxicology',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      res.json(await toxRepo.getByPatient(req.params.id, tenantId) || null);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/toxicology',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await toxRepo.upsert({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        recordedBy: req.body.recordedBy || req.user.name,
      });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
