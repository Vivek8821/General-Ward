const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db');
const { auditLog } = require('./middleware/audit');

// Import routes
const authRoutes = require('./controllers/AuthController');
const patientRoutes = require('./controllers/PatientController');
const statRoutes = require('./routes/stats');
const medicationRoutes = require('./routes/medications');
const escalationRoutes = require('./controllers/EscalationController');
const historyRoutes = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(auditLog); // Attach audit logging globally

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients/:patientId/history', historyRoutes);
app.use('/api/patients/:patientId/stats', statRoutes);
app.use('/api/patients/:patientId/medications', medicationRoutes);
app.use('/api/patients/:patientId/escalations', escalationRoutes);
app.use('/api/escalations', escalationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'General Ward API is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
