const express = require('express');
const cors = require('cors');
const db = require('./db');

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const statRoutes = require('./routes/stats');
const medicationRoutes = require('./routes/medications');
const escalationRoutes = require('./routes/escalations');
const historyRoutes = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
