const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { auditLog } = require('./middleware/audit');
const { requestLogger } = require('./middleware/requestLogger');
const { checkPostgresConnectivity } = require('./postgres');
const { attachUserIfPresent, authenticateToken } = require('./middleware/auth');
const { verifyCsrfForMutations } = require('./middleware/csrf');

// Import routes
// Import routes
const authRoutes = require('./controllers/AuthController');
const patientRoutes = require('./controllers/PatientController');
const statRoutes = require('./routes/stats');
const medicationRoutes = require('./routes/medications');
const escalationRoutes = require('./controllers/EscalationController');
const historyRoutes = require('./routes/history');
const tasksRoutes = require('./routes/tasks');
const observationsRoutes = require('./routes/observations');
const adminAuditRoutes = require('./routes/adminAudit');

const app = express();
const PORT = process.env.PORT || 3001;

function getCorsMiddleware() {
    const isProd = process.env.NODE_ENV === 'production';
    const raw = process.env.CORS_ORIGIN;

    if (isProd) {
        if (!raw || String(raw).trim() === '') {
            throw new Error(
                '[cors] CORS_ORIGIN must be set in production (comma-separated origins, e.g. https://app.example.com)'
            );
        }
        const origin = String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (origin.length === 0) {
            throw new Error('[cors] CORS_ORIGIN must list at least one origin in production');
        }
        return cors({
            origin,
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
        });
    }

    if (raw && String(raw).trim() !== '') {
        const origin = String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        return cors({
            origin,
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
        });
    }

    // Frontend uses `credentials: 'include'` for cookie-based auth.
    // Browsers will reject responses when:
    // - `Access-Control-Allow-Origin` is `*`, while
    // - the request is sent with credentials.
    //
    // For non-production with no explicit `CORS_ORIGIN`, we must echo the
    // request's `Origin` header and enable credentials.
    return cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, false);
            return cb(null, origin);
        },
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
    });
}

// Middleware
// Needed so `req.ip` and related rate-limiting/lockout logic work correctly behind proxies.
app.set('trust proxy', 1);
app.use(getCorsMiddleware());
app.use(helmet());
app.use(express.json({ limit: '512kb' }));
app.use('/api', attachUserIfPresent);
app.use('/api', verifyCsrfForMutations);
app.use(auditLog); // Attach audit logging globally
app.use(requestLogger); // Structured request logging

const backendVersion = require('./package.json').version;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/observations', observationsRoutes);
app.use('/api/admin', adminAuditRoutes);

// Health check — minimal public surface (no DB topology in body).
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/version', (req, res) => {
    res.json({ backendVersion });
});

// Authenticated ops may check DB readiness (avoids exposing infra in public /health).
app.get('/api/health/detail', authenticateToken, async (req, res) => {
    try {
        const postgres = await checkPostgresConnectivity();
        res.json({
            status: 'ok',
            postgres,
        });
    } catch (err) {
        res.json({
            status: 'ok',
            postgres: { enabled: false, ok: false },
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
