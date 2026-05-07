const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { auditLog } = require('./middleware/audit');
const { requestLogger } = require('./middleware/requestLogger');
const { attachUserIfPresent, authenticateToken } = require('./middleware/auth');
const { verifyCsrfForMutations } = require('./middleware/csrf');

// Import routes
const authRoutes = require('./controllers/AuthController');
const patientRoutes = require('./controllers/PatientController');
const medicationRoutes = require('./controllers/MedicationController');
const escalationRoutes = require('./controllers/EscalationController');
const tasksRoutes = require('./controllers/TaskController');
const observationsRoutes = require('./controllers/ObservationController');
const pharmacyRoutes = require('./controllers/PharmacyController');
const barcodeRoutes = require('./controllers/BarcodeController');
const adminAuditRoutes = require('./routes/adminAudit');
const errorHandler = require('./middleware/error');
const migratorService = require('./services/MigratorService');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

function getCorsMiddleware() {
    const isProdLike = config.isProdLike;

    if (isProdLike) {
        if (config.cors.mode !== 'explicit') {
            throw new Error(
                '[cors] CORS_ORIGIN must be set in production/staging (comma-separated origins, e.g. https://app.example.com)'
            );
        }
        const origin = config.cors.origins;
        return cors({
            origin,
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
        });
    }

    if (config.cors.mode === 'explicit') {
        const origin = config.cors.origins;
        return cors({
            origin,
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
        });
    }

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
// Only trust proxy headers when explicitly enabled (set TRUST_PROXY=1 behind nginx/ELB).
// Default 0 prevents X-Forwarded-For spoofing of IP-based rate limits.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '0', 10));
app.use(getCorsMiddleware());
app.use(
    helmet({
        contentSecurityPolicy: config.isProdLike
            ? {
                  directives: {
                      defaultSrc: ["'none'"],
                      baseUri: ["'none'"],
                      formAction: ["'none'"],
                      frameAncestors: ["'none'"],
                      connectSrc: ["'self'"],
                      imgSrc: ["'self'", 'data:'],
                      scriptSrc: ["'self'"],
                      styleSrc: ["'self'"],
                      fontSrc: ["'self'"],
                      objectSrc: ["'none'"],
                      upgradeInsecureRequests: [],
                  },
              }
            : false,
    })
);
app.use(express.json({ limit: '512kb' }));
app.use('/api', attachUserIfPresent);
app.use('/api', verifyCsrfForMutations);
app.use(auditLog);
app.use(requestLogger);

const backendVersion = require('./package.json').version;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/observations', observationsRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/pharmacy/barcodes', barcodeRoutes);
app.use('/api/admin', adminAuditRoutes);
app.use('/api/admin/users', require('./controllers/UserController'));
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'General Ward API is running', version: backendVersion });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/version', (req, res) => {
    res.json({ backendVersion });
});

app.get('/api/health/detail', authenticateToken, async (req, res) => {
    try {
        const { pool } = require('./db-postgres');
        await pool.query('SELECT 1');
        res.json({
            status: 'ok',
            postgres: { enabled: true, ok: true },
        });
    } catch (err) {
        res.json({
            status: 'ok',
            postgres: { enabled: true, ok: false, error: err.message },
        });
    }
});

// Catch-all 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

// Global Error Handler
app.use(errorHandler);

async function startServer() {
  const startupMode = process.env.STARTUP_MODE || 'full';
  const dialect = process.env.DB_DIALECT || 'sqlite';
  
  try {
    console.log(`🚀 [Protocol] Starting General Ward API [Database: ${dialect}]`);
    
    if (startupMode === 'perf') {
      console.log('🚀 [Protocol] Starting in PERFORMANCE mode (skipping migrations)');
    } else {
      console.log('📦 [Protocol] Starting in FULL mode (running migrations)');
      
      if (dialect === 'postgres') {
        const { initPostgresDb } = require('./db-postgres');
        await initPostgresDb();
      } else {
        // Run the legacy initialization (backfills, triggers, etc.)
        await initDb();
        // Run schema migrations from SQL file
        await migratorService.runMigrations();
      }
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} [Mode: ${startupMode}]`);
    });
  } catch (err) {
    console.error('Critical failure during startup:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app };
