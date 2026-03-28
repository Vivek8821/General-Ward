const dbAdapter = require('../dbAdapter');

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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = {
  requireTenantPatient,
  requireTenantTask,
  requireTenantMedication,
  requireTenantMedicationAdministration,
  requireTenantEscalation,
};
