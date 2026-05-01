/**
 * RBAC Policy Module
 * Defines roles and their associated permissions.
 */

const ROLES = {
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  ADMIN: 'admin',
};

const PERMISSIONS = {
  // Patient Data
  READ_PATIENT: 'read_patient',
  WRITE_PATIENT: 'write_patient', // Create/Edit patient
  DISCHARGE_PATIENT: 'discharge_patient',

  // Clinical Actions
  WRITE_VITALS: 'write_vitals',
  WRITE_MEDICATIONS: 'write_medications',
  ADMINISTER_MEDS: 'administer_meds',
  WRITE_NOTES: 'write_notes',

  // Administrative
  VIEW_AUDIT: 'view_audit',
  PURGE_AUDIT: 'purge_audit',
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
    PERMISSIONS.VIEW_AUDIT,
  ],
  [ROLES.NURSE]: [
    PERMISSIONS.READ_PATIENT,
    PERMISSIONS.WRITE_VITALS,
    PERMISSIONS.ADMINISTER_MEDS,
    PERMISSIONS.WRITE_NOTES,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.READ_PATIENT,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.PURGE_AUDIT,
  ],
};

/**
 * Middleware to check if the authenticated user has a specific permission.
 */
function authorize(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    const allowedPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!allowedPermissions.includes(permission)) {
      return res.status(403).json({
        error: `Forbidden: Missing required permission [${permission}]`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
}

/**
 * Convenience middleware for multiple permissions (OR logic).
 */
function authorizeAny(permissions) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    const allowedPermissions = ROLE_PERMISSIONS[userRole] || [];

    const hasAny = permissions.some((p) => allowedPermissions.includes(p));

    if (!hasAny) {
      return res.status(403).json({
        error: `Forbidden: Missing one of required permissions [${permissions.join(', ')}]`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  authorize,
  authorizeAny,
};
