const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db');
const { auditLog } = require('./middleware/audit');
const { requestLogger } = require('./middleware/requestLogger');

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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Needed so `req.ip` and related rate-limiting/lockout logic work correctly behind proxies.
app.set('trust proxy', 1);
app.use(cors());
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'General Ward API is running' });
});

app.get('/api/version', (req, res) => {
    res.json({ backendVersion });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
