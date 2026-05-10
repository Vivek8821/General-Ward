const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const authRoutes = require('../../controllers/AuthController');
const { initDb } = require('../../db');
const config = require('../../config');
const JWT_SECRET = config.jwtSecret;

describe('Cookie-based auth (Phase C.2)', () => {
  beforeAll(async () => {
    await initDb();
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    return app;
  }

  it('GET /api/auth/me authenticates when ward_token cookie is provided', async () => {
    const token = jwt.sign(
      { id: 'u-cookie', name: 'Cookie User', role: 'doctor', tenantId: 'tenant-default' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const app = makeApp();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `ward_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe('u-cookie');
    expect(res.body.user.role).toBe('doctor');
  });

  it('GET /api/auth/me returns 401 when neither Authorization header nor ward_token cookie exists', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/No token provided/i);
  });
});

