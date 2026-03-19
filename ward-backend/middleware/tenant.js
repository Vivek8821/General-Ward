const { db } = require('../db');

const DEFAULT_TENANT_ID = 'tenant-default';

function getTenantId(req) {
  return req.user?.tenantId || DEFAULT_TENANT_ID;
}

// Ensures a patientId belongs to the caller's tenant.
function requireTenantPatient(paramName = 'patientId') {
  return (req, res, next) => {
    const patientId = req.params[paramName];
    const tenantId = getTenantId(req);

    if (!patientId) return res.status(400).json({ error: `${paramName} is required` });

    db.get(
      `SELECT id FROM Patients WHERE id = ? AND tenantId = ?`,
      [patientId, tenantId],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(403).json({ error: 'Access denied by tenant scope.' });
        next();
      }
    );
  };
}

function requireTenantTask(taskIdParam = 'taskId') {
  return (req, res, next) => {
    const taskId = req.params[taskIdParam];
    const tenantId = getTenantId(req);

    if (!taskId) return res.status(400).json({ error: `${taskIdParam} is required` });

    db.get(`SELECT tenantId FROM Tasks WHERE id = ?`, [taskId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Task not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    });
  };
}

function requireTenantMedication(medIdParam = 'medId', patientIdParam = 'patientId') {
  return (req, res, next) => {
    const medId = req.params[medIdParam];
    const patientId = req.params[patientIdParam];
    const tenantId = getTenantId(req);

    if (!medId || !patientId) return res.status(400).json({ error: 'Medication identifiers are required' });

    db.get(
      `SELECT tenantId FROM Medications WHERE id = ? AND patientId = ?`,
      [medId, patientId],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Medication not found' });
        if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
        next();
      }
    );
  };
}

function requireTenantMedicationAdministration(adminIdParam = 'adminId', patientIdParam = 'patientId') {
  return (req, res, next) => {
    const adminId = req.params[adminIdParam];
    const patientId = req.params[patientIdParam];
    const tenantId = getTenantId(req);

    if (!adminId || !patientId) return res.status(400).json({ error: 'Administration identifiers are required' });

    db.get(
      `SELECT tenantId FROM MedicationAdministrations WHERE id = ? AND patientId = ?`,
      [adminId, patientId],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Administration not found' });
        if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
        next();
      }
    );
  };
}

function requireTenantEscalation(escalationIdParam = 'escalationId') {
  return (req, res, next) => {
    const escalationId = req.params[escalationIdParam];
    const tenantId = getTenantId(req);

    if (!escalationId) return res.status(400).json({ error: `${escalationIdParam} is required` });

    db.get(`SELECT tenantId FROM Escalations WHERE id = ?`, [escalationId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Escalation not found' });
      if (row.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied by tenant scope.' });
      next();
    });
  };
}

module.exports = {
  requireTenantPatient,
  requireTenantTask,
  requireTenantMedication,
  requireTenantMedicationAdministration,
  requireTenantEscalation
};

