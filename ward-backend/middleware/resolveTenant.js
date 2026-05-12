module.exports = function resolveTenant(req, res, next) {
  req.tenantId = req.user?.tenantId || 'tenant-default';
  next();
};
