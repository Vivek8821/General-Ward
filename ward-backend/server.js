const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db');
const { auditLog } = require('./middleware/audit');
const { requestLogger } = require('./middleware/requestLogger');
const { checkPostgresConnectivity } = require('./postgres');

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
        return cors({ origin, credentials: true });
    }

    if (raw && String(raw).trim() !== '') {
        const origin = String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        return cors({ origin, credentials: true });
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
    });
}

// Middleware
// Needed so `req.ip` and related rate-limiting/lockout logic work correctly behind proxies.
app.set('trust proxy', 1);
app.use(getCorsMiddleware());
app.use(helmet());
app.use(express.json());
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

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const postgres = await checkPostgresConnectivity();
        res.json({
            status: 'ok',
            message: 'General Ward API is running',
            postgres,
        });
    } catch (err) {
        // Health checks should never fail the whole endpoint.
        res.json({
            status: 'ok',
            message: 'General Ward API is running',
            postgres: { enabled: false, ok: false },
        });
    }
});

app.get('/api/version', (req, res) => {
    res.json({ backendVersion });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
