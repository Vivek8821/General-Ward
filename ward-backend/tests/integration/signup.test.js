const request = require('supertest');
const express = require('express');
const authRoutes = require('../../controllers/AuthController');
const { initDb, db } = require('../../db');

const uniqueCode = () => `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

describe('Signup Integration', () => {
    let app;

    beforeAll(async () => {
        await initDb();
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
    });

    afterAll(async () => {
        // Clean up any tenants and users created by this suite
        await new Promise((resolve) => {
            db.run(`DELETE FROM Users WHERE name LIKE 'signup-test-%'`, () => resolve());
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM Tenants WHERE id LIKE 'signup-test-%'`, () => resolve());
        });
    });

    it('creates a new hospital tenant and admin user, returns cookie + csrfToken', async () => {
        const code = uniqueCode();
        const res = await request(app)
            .post('/api/auth/signup')
            .send({
                hospitalName: 'Test Hospital',
                hospitalCode: code,
                adminName: `signup-test-${code}`,
                email: 'admin@testhospital.com',
                password: 'securepassword123',
            });

        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('admin');
        expect(res.body.user.tenantId).toBe(code.toLowerCase());
        expect(res.body.csrfToken).toBeDefined();
        expect(res.header['set-cookie']).toBeDefined();
        expect(res.header['set-cookie'][0]).toContain('ward_token');
    });

    it('returns 409 TENANT_EXISTS when hospitalCode is already registered', async () => {
        const code = uniqueCode();
        // First signup
        await request(app).post('/api/auth/signup').send({
            hospitalName: 'Hospital A',
            hospitalCode: code,
            adminName: `signup-test-a-${code}`,
            password: 'password1234',
        });
        // Duplicate
        const res = await request(app).post('/api/auth/signup').send({
            hospitalName: 'Hospital B',
            hospitalCode: code,
            adminName: `signup-test-b-${code}`,
            password: 'password1234',
        });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('TENANT_EXISTS');
    });

    it('returns 409 USER_EXISTS when adminName is already taken', async () => {
        const sharedName = `signup-test-shared-${Date.now()}`;
        await request(app).post('/api/auth/signup').send({
            hospitalName: 'Hospital C',
            hospitalCode: uniqueCode(),
            adminName: sharedName,
            password: 'password1234',
        });
        const res = await request(app).post('/api/auth/signup').send({
            hospitalName: 'Hospital D',
            hospitalCode: uniqueCode(),
            adminName: sharedName,
            password: 'password1234',
        });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('USER_EXISTS');
    });

    it('returns 400 when password is shorter than 8 characters', async () => {
        const res = await request(app).post('/api/auth/signup').send({
            hospitalName: 'X',
            hospitalCode: uniqueCode(),
            adminName: 'signup-test-short',
            password: 'short',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/8 characters/);
    });

    it('returns 400 when hospitalName is missing', async () => {
        const res = await request(app).post('/api/auth/signup').send({
            hospitalCode: uniqueCode(),
            adminName: 'signup-test-nohospital',
            password: 'password1234',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Hospital name/);
    });

    it('returns 400 when hospitalCode is missing', async () => {
        const res = await request(app).post('/api/auth/signup').send({
            hospitalName: 'Some Hospital',
            adminName: 'signup-test-nocode',
            password: 'password1234',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Hospital code/);
    });

    it('returns 400 when adminName is missing', async () => {
        const res = await request(app).post('/api/auth/signup').send({
            hospitalName: 'Some Hospital',
            hospitalCode: uniqueCode(),
            password: 'password1234',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Admin name/);
    });
});
