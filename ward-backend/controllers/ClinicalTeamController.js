const express = require('express');
const router = express.Router({ mergeParams: true });
const teamRepo = require('../repositories/ClinicalTeamRepository');
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const { requireTenantPatient } = require('../middleware/tenant');
const { clinicalWriteLimiter } = require('../middleware/rateLimiters');

function validate(body) {
  if (!body.role || typeof body.role !== 'string') return 'role is required';
  if (!body.name || typeof body.name !== 'string') return 'name is required';
  return null;
}

router.get('/:id/team',
  authenticateToken, authorize(PERMISSIONS.READ_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      res.json(await teamRepo.getByPatient(req.params.id, tenantId));
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.post('/:id/team',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.DISCHARGE_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await teamRepo.create({
        ...req.body,
        patientId: req.params.id,
        tenantId,
      });
      res.status(201).json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.put('/:id/team/:memberId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.DISCHARGE_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      const result = await teamRepo.update(req.params.memberId, tenantId, req.body);
      if (!result) return res.status(404).json({ error: 'Team member not found' });
      res.json(result);
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

router.delete('/:id/team/:memberId',
  authenticateToken, clinicalWriteLimiter, authorize(PERMISSIONS.DISCHARGE_PATIENT), requireTenantPatient('id'),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId || 'tenant-default';
      await teamRepo.delete(req.params.memberId, tenantId);
      res.status(204).end();
    } catch (err) {
      err.status = 500; next(err);
    }
  }
);

module.exports = router;
