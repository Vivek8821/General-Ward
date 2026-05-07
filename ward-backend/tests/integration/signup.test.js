const request = require('supertest');
const express = require('express');
const authRoutes = require('../../controllers/AuthController');
const { initDb, db } = require('../../db');

describe('Signup Integration', () => {
    let app;

    beforeAll(async () => {
        await initDb();
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        
        // Clean up user if exists
        await new Promise((resolve) => {
          db.run(`DELETE FROM Users WHERE name = ?`, ['newuser'], () => resolve());
        });
    });

    it('should successfully sign up a new user', async () => {
        const payload = { 
          username: 'newuser', 
          password: 'password123', 
          role: 'doctor', 
          hospitalName: 'General Ward' 
        };
        
        const res = await request(app).post('/api/auth/signup').send(payload);
        
        expect(res.status).toBe(201);
        expect(res.body.user.name).toBe('newuser');
        expect(res.body.user.role).toBe('doctor');
        expect(res.body.csrfToken).toBeDefined();
        expect(res.header['set-cookie']).toBeDefined();
        expect(res.header['set-cookie'][0]).toContain('ward_token');
    });

    it('should fail if username already exists', async () => {
        const payload = { 
          username: 'newuser', 
          password: 'password123', 
          role: 'doctor'
        };
        
        const res = await request(app).post('/api/auth/signup').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Username already exists');
    });

    it('should fail if required fields are missing', async () => {
        const payload = { username: 'incomplete' };
        const res = await request(app).post('/api/auth/signup').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Username, password and role are required');
    });
});
