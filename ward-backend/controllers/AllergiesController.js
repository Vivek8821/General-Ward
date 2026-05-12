const express = require('express');
const router = express.Router({ mergeParams: true });
const allergyRepo = require('../repositories/StructuredAllergyRepository');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter } = require('../middleware/rateLimiters');

const VALID_CATEGORIES = ['drug', 'food', 'environmental', 'other'];
const VALID_SEVERITIES = ['mild', 'moderate', 'severe', 'high'];

function validate(body) {
  if (!body.allergen || typeof body.allergen !== 'string') return 'allergen is required';
  if (!VALID_CATEGORIES.includes(body.category)) return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  if (!body.reaction || typeof body.reaction !== 'string') return 'reaction is required';
  if (!VALID_SEVERITIES.includes(body.severity)) return `severity must be one of: ${VALID_SEVERITIES.join(', ')}`;
  return null;
}

router.get('/:id/allergies',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      res.json(await allergyRepo.getByPatient(req.params.id, tenantId));
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.post('/:id/allergies',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await allergyRepo.create({
        ...req.body,
        patientId: req.params.id,
        tenantId,
        recordedBy: req.user.name,
      });
      res.status(201).json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/allergies/:allergyId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await allergyRepo.update(req.params.allergyId, tenantId, req.body);
      if (!result) return res.status(404).json({ error: 'Allergy record not found' });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.delete('/:id/allergies/:allergyId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.WRITE_CLINICAL_RECORDS), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      await allergyRepo.delete(req.params.allergyId, tenantId);
      res.status(204).end();
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
