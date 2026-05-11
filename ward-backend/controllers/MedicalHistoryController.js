const express = require('express');
const router = express.Router({ mergeParams: true });
const medicalHistoryRepo = require('../repositories/MedicalHistoryRepository');
const { validateMedicalHistory, bad } = require('../utils/validation');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');

router.get('/:id/medical-history',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await medicalHistoryRepo.getByPatient(req.params.id, tenantId);
      res.json(result || {});
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/medical-history',
  authenticateToken, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const errors = validateMedicalHistory(req.body || {});
    if (errors.length > 0) return bad(res, errors);

    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await medicalHistoryRepo.upsert({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        createdBy: req.user.name,
        updatedBy: req.user.name,
      });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
