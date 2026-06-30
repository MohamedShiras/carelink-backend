import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './models/index.js';
import authRoutes from './routes/auth.routes.js';
import triageRoutes from './routes/triage.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Parse incoming request JSON bodies
app.use(express.json());

// Base Health Check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CareLink Backend API'
  });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use(errorHandler);

// Database Sync and Server Bootstrap
const startServer = async () => {
  try {
    // Sync database (creates tables if they don't exist)
    await sequelize.sync({ force: false });
    console.log('Database synced successfully (SQLite).');

    app.listen(PORT, () => {
      console.log(`CareLink backend server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start CareLink server:', error);
    process.exit(1);
  }
};

startServer();
