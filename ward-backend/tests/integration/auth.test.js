const request = require('supertest');
const express = require('express');
const authRoutes = require('../../controllers/AuthController');

describe('Auth Integration & Rate Limiting', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        // Trust proxy is required for express-rate-limit if behind a proxy
        app.set('trust proxy', 1);
        app.use('/api/auth', authRoutes);
    });

    it('should block excessive login attempts via Rate Limiting (HTTP 429)', async () => {
        const payload = { username: 'Dr. Fake', password: 'wrongpassword' };
        
        // Make 5 failed attempts (the limit set in AuthController)
        for (let i = 0; i < 5; i++) {
            const res = await request(app).post('/api/auth/login').send(payload);
            expect(res.status).toBe(401); // Standard Auth failure for first 5 limits
        }

        // The 6th attempt should hit the Rate Limiter
        const rateLimitedRes = await request(app).post('/api/auth/login').send(payload);
        
        expect(rateLimitedRes.status).toBe(429);
        expect(rateLimitedRes.body.error).toBe('Too many login attempts from this IP, please try again after 15 minutes');
    });
});
