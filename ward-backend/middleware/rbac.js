const ROLES = {
  DOCTOR:      'doctor',
  NURSE:       'nurse',
  PHARMACIST:  'pharmacist',
  ADMIN:       'admin',
};

const PERMISSIONS = {
  // Patient & clinical
  READ_PATIENT:      'read_patient',
  WRITE_PATIENT:     'write_patient',
  DISCHARGE_PATIENT: 'discharge_patient',
  WRITE_VITALS:      'write_vitals',
  WRITE_MEDICATIONS: 'write_medications',
  ADMINISTER_MEDS:   'administer_meds',
  WRITE_NOTES:       'write_notes',
  WRITE_TASKS:       'write_tasks',
  READ_TASKS:        'read_tasks',

  // Pharmacy
  READ_PHARMACY:   'read_pharmacy',
  MANAGE_PHARMACY: 'manage_pharmacy',

  // Statistics
  VIEW_STATISTICS: 'view_statistics',

  // Admin
  VIEW_AUDIT:   'view_audit',
  PURGE_AUDIT:  'purge_audit',
  MANAGE_USERS: 'manage_users',
};

const ROLE_PERMISSIONS = {
  [ROLES.DOCTOR]: [
    PERMISSIONS.READ_PATIENT,
    PERMISSIONS.WRITE_PATIENT,
    PERMISSIONS.DISCHARGE_PATIENT,
    PERMISSIONS.WRITE_VITALS,
    PERMISSIONS.WRITE_MEDICATIONS,
    PERMISSIONS.ADMINISTER_MEDS,
    PERMISSIONS.WRITE_NOTES,
    PERMISSIONS.WRITE_TASKS,
    PERMISSIONS.READ_TASKS,
    PERMISSIONS.READ_PHARMACY,
    PERMISSIONS.VIEW_STATISTICS,
  ],
  [ROLES.NURSE]: [
    PERMISSIONS.READ_PATIENT,
    PERMISSIONS.WRITE_VITALS,
    PERMISSIONS.ADMINISTER_MEDS,
    PERMISSIONS.WRITE_NOTES,
    PERMISSIONS.WRITE_TASKS,
    PERMISSIONS.READ_TASKS,
    PERMISSIONS.READ_PHARMACY,
    PERMISSIONS.VIEW_STATISTICS,
  ],
  [ROLES.PHARMACIST]: [
    PERMISSIONS.READ_PHARMACY,
    PERMISSIONS.MANAGE_PHARMACY,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.READ_PATIENT,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.PURGE_AUDIT,
    PERMISSIONS.READ_TASKS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_STATISTICS,
  ],
};

function authorize(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.role)
      return res.status(401).json({ error: 'Authentication required' });
    const allowed = ROLE_PERMISSIONS[req.user.role] || [];
    if (!allowed.includes(permission))
      return res.status(403).json({
        error: `Forbidden: Missing required permission [${permission}]`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    next();
  };
}

function authorizeAny(permissions) {
  return (req, res, next) => {
    if (!req.user || !req.user.role)
      return res.status(401).json({ error: 'Authentication required' });
    const allowed = ROLE_PERMISSIONS[req.user.role] || [];
    if (!permissions.some(p => allowed.includes(p)))
      return res.status(403).json({
        error: `Forbidden: Missing one of required permissions [${permissions.join(', ')}]`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    next();
  };
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, authorize, authorizeAny };
