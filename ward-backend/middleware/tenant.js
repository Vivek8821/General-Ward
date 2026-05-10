const dbAdapter = require('../db-adapter');

const DEFAULT_TENANT_ID = 'tenant-default';

function getTenantId(req) {
  return req.user?.tenantId || DEFAULT_TENANT_ID;
}

function requireTenantPatient(paramName = 'patientId') {
  return async (req, res, next) => {
    try {
      const patientId = req.params[paramName];
      const tenantId = getTenantId(req);

      if (!patientId) return res.status(400).json({ error: `${paramName} is required` });

      const row = await dbAdapter.get(`SELECT id FROM Patients WHERE id = ? AND tenantId = ?`, [
        patientId,
        tenantId,
      ]);
      if (!row) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireTenantTask(taskIdParam = 'taskId') {
  return async (req, res, next) => {
    try {
      const taskId = req.params[taskIdParam];
      const tenantId = getTenantId(req);

      if (!taskId) return res.status(400).json({ error: `${taskIdParam} is required` });

      const row = await dbAdapter.get(`SELECT tenantId FROM Tasks WHERE id = ?`, [taskId]);
      if (!row) return res.status(404).json({ error: 'Task not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireTenantMedication(medIdParam = 'medId', patientIdParam = 'patientId') {
  return async (req, res, next) => {
    try {
      const medId = req.params[medIdParam];
      const patientId = req.params[patientIdParam];
      const tenantId = getTenantId(req);

      if (!medId || !patientId) {
        return res.status(400).json({ error: 'Medication identifiers are required' });
      }

      const row = await dbAdapter.get(
        `SELECT tenantId FROM Medications WHERE id = ? AND patientId = ?`,
        [medId, patientId]
      );
      if (!row) return res.status(404).json({ error: 'Medication not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireTenantMedicationAdministration(adminIdParam = 'adminId', patientIdParam = 'patientId') {
  return async (req, res, next) => {
    try {
      const adminId = req.params[adminIdParam];
      const patientId = req.params[patientIdParam];
      const tenantId = getTenantId(req);

      if (!adminId || !patientId) {
        return res.status(400).json({ error: 'Administration identifiers are required' });
      }

      const row = await dbAdapter.get(
        `SELECT tenantId FROM MedicationAdministrations WHERE id = ? AND patientId = ?`,
        [adminId, patientId]
      );
      if (!row) return res.status(404).json({ error: 'Administration not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireTenantEscalation(escalationIdParam = 'escalationId') {
  return async (req, res, next) => {
    try {
      const escalationId = req.params[escalationIdParam];
      const tenantId = getTenantId(req);

      if (!escalationId) return res.status(400).json({ error: `${escalationIdParam} is required` });

      const row = await dbAdapter.get(`SELECT tenantId FROM Escalations WHERE id = ?`, [escalationId]);
      if (!row) return res.status(404).json({ error: 'Escalation not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireTenantPharmacyStock(stockIdParam = 'id') {
  return async (req, res, next) => {
    try {
      const stockId = req.params[stockIdParam];
      const tenantId = getTenantId(req);

      if (!stockId) return res.status(400).json({ error: `${stockIdParam} is required` });

      const row = await dbAdapter.get(`SELECT tenantId FROM PharmacyStock WHERE id = ?`, [stockId]);
      if (!row) return res.status(404).json({ error: 'Medication stock record not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireTenantPharmacyBatch(batchIdParam = 'batchId') {
  return async (req, res, next) => {
    try {
      const batchId = req.params[batchIdParam];
      const tenantId = getTenantId(req);

      if (!batchId) return res.status(400).json({ error: `${batchIdParam} is required` });

      const row = await dbAdapter.get(`SELECT tenantId FROM PharmacyBatches WHERE id = ?`, [batchId]);
      if (!row) return res.status(404).json({ error: 'Medication batch not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireTenantPatient,
  requireTenantTask,
  requireTenantMedication,
  requireTenantMedicationAdministration,
  requireTenantEscalation,
  requireTenantPharmacyStock,
  requireTenantPharmacyBatch,
};
