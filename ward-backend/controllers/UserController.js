const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { PERMISSIONS, authorize } = require('../middleware/rbac');
const authService = require('../services/AuthService');
const dbAdapter = require('../db-adapter');
const { validateUserPayload, bad } = require('../utils/validation');
const { adminWriteLimiter } = require('../middleware/rateLimiters');

// GET /api/admin/users
router.get('/', authenticateToken, authorize(PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const rows = await dbAdapter.all(
      `SELECT id, name, role, email, tenantId FROM Users WHERE tenantId = ? ORDER BY role, name`,
      [tenantId]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users
router.post('/', authenticateToken, adminWriteLimiter, authorize(PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  const errors = validateUserPayload(req.body || {});
  if (errors.length > 0) return bad(res, errors);

  try {
    const { name, role, email, password } = req.body || {};
    const user = await authService.createStaffMember({ adminUser: req.user, name, role, email, password });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === 'USER_EXISTS') return res.status(409).json({ error: err.message, code: 'USER_EXISTS' });
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/:id', authenticateToken, adminWriteLimiter, authorize(PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (id === req.user.id)
      return res.status(400).json({ error: 'Cannot delete your own account', code: 'CANNOT_DELETE_SELF' });

    const target = await dbAdapter.get(
      `SELECT id, role FROM Users WHERE id = ? AND tenantId = ?`, [id, tenantId]
    );
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin')
      return res.status(403).json({ error: 'Cannot delete admin accounts', code: 'CANNOT_DELETE_ADMIN' });

    await dbAdapter.run(`DELETE FROM Users WHERE id = ? AND tenantId = ?`, [id, tenantId]);
    res.json({ message: 'User removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
