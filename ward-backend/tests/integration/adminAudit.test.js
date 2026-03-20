const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

const { authenticateToken, requireRole } = require('../../middleware/auth');
const adminAuditRoutes = require('../../routes/adminAudit');
const { initDb, db } = require('../../db');

jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    authenticateToken: (req, res, next) => {
      req.user = global.__adminAuditMockUser;
      next();
    },
    requireRole: actual.requireRole,
    JWT_SECRET: actual.JWT_SECRET,
  };
});

function insertAuditRow({ id, tenantId, userId = 'u-admin', ts }) {
  return new Promise((resolve, reject) => {
    if (ts != null) {
      db.run(
        `INSERT INTO AuditLogs (id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success, timestamp)
         VALUES (?, ?, 'admin', ?, 'GET', '/api/test', '127.0.0.1', 200, 1, ?)`,
        [id, userId, tenantId, ts],
        (err) => (err ? reject(err) : resolve())
      );
    } else {
      db.run(
        `INSERT INTO AuditLogs (id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success, timestamp)
         VALUES (?, ?, 'admin', ?, 'GET', '/api/test', '127.0.0.1', 200, 1, datetime('now'))`,
        [id, userId, tenantId],
        (err) => (err ? reject(err) : resolve())
      );
    }
  });
}

describe('Admin audit logs API', () => {
  const tenantA = 'tenant-default';
  const tenantB = 'tenant-b';

  beforeAll(async () => {
    await initDb();
    await new Promise((resolve, reject) => {
      db.run(`INSERT OR IGNORE INTO Tenants (id, name) VALUES (?, ?)`, [tenantB, 'Tenant B'], (err) =>
        err ? reject(err) : resolve()
      );
    });
  });

  beforeEach(async () => {
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM AuditLogs WHERE id LIKE 'audit-test-%'`, (err) => (err ? reject(err) : resolve()));
    });
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminAuditRoutes);
    return app;
  }

  it('returns 403 for non-admin role', async () => {
    global.__adminAuditMockUser = { id: 'u1', name: 'Dr', role: 'doctor', tenantId: tenantA };
    const app = makeApp();
    const res = await request(app).get('/api/admin/audit-logs');
    expect(res.status).toBe(403);
  });

  it('lists only rows for the admin tenant', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const id1 = `audit-test-${crypto.randomUUID()}`;
    const id2 = `audit-test-${crypto.randomUUID()}`;
    const idB = `audit-test-${crypto.randomUUID()}`;
    await insertAuditRow({ id: id1, tenantId: tenantA });
    await insertAuditRow({ id: id2, tenantId: tenantA });
    await insertAuditRow({ id: idB, tenantId: tenantB });

    const app = makeApp();
    const res = await request(app).get('/api/admin/audit-logs?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    const ids = res.body.items.map((r) => r.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(ids).not.toContain(idB);
  });

  it('filters by success=0', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const okId = `audit-test-${crypto.randomUUID()}`;
    const failId = `audit-test-${crypto.randomUUID()}`;
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO AuditLogs (id, userId, userRole, tenantId, action, resource, ipAddress, statusCode, success, timestamp)
         VALUES (?, 'u1', 'doctor', ?, 'GET', '/x', '127.0.0.1', 403, 0, datetime('now'))`,
        [failId, tenantA],
        (err) => (err ? reject(err) : resolve())
      );
    });
    await insertAuditRow({ id: okId, tenantId: tenantA });

    const app = makeApp();
    const res = await request(app).get('/api/admin/audit-logs?success=0&limit=20');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((r) => r.id);
    expect(ids).toContain(failId);
    expect(ids).not.toContain(okId);
  });

  it('exports CSV with header', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const id1 = `audit-test-${crypto.randomUUID()}`;
    await insertAuditRow({ id: id1, tenantId: tenantA });

    const app = makeApp();
    const res = await request(app).get('/api/admin/audit-logs/export.csv?limit=5');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split(/\r?\n/)[0]).toContain('timestamp');
    expect(res.text).toContain(id1);
  });

  it('purge dryRun returns count with olderThanDays in body', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const oldId = `audit-test-${crypto.randomUUID()}`;
    await insertAuditRow({ id: oldId, tenantId: tenantA, ts: '2000-01-01 00:00:00' });

    const app = makeApp();
    const res = await request(app).post('/api/admin/audit/purge').send({ dryRun: true, olderThanDays: 365 });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.wouldDelete).toBeGreaterThanOrEqual(1);
  });

  it('purge execute deletes old rows for tenant only', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const oldId = `audit-test-${crypto.randomUUID()}`;
    const oldB = `audit-test-${crypto.randomUUID()}`;
    await insertAuditRow({ id: oldId, tenantId: tenantA, ts: '1999-06-01 12:00:00' });
    await insertAuditRow({ id: oldB, tenantId: tenantB, ts: '1999-06-01 12:00:00' });

    const app = makeApp();
    const res = await request(app).post('/api/admin/audit/purge').send({ dryRun: false, olderThanDays: 1 });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBeGreaterThanOrEqual(1);

    const stillB = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM AuditLogs WHERE id = ?`, [oldB], (err, row) => (err ? reject(err) : resolve(row)));
    });
    expect(stillB).toBeTruthy();

    const goneA = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM AuditLogs WHERE id = ?`, [oldId], (err, row) => (err ? reject(err) : resolve(row)));
    });
    expect(goneA).toBeFalsy();
  });

  it('purge returns 400 when dryRun false and no days source', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const prev = process.env.AUDIT_RETENTION_DAYS;
    delete process.env.AUDIT_RETENTION_DAYS;
    const app = makeApp();
    const res = await request(app).post('/api/admin/audit/purge').send({ dryRun: false });
    if (prev !== undefined) process.env.AUDIT_RETENTION_DAYS = prev;
    expect(res.status).toBe(400);
  });

  it('rejects invalid limit', async () => {
    global.__adminAuditMockUser = { id: 'u-admin', name: 'Admin', role: 'admin', tenantId: tenantA };
    const app = makeApp();
    const res = await request(app).get('/api/admin/audit-logs?limit=0');
    expect(res.status).toBe(400);
  });
});
