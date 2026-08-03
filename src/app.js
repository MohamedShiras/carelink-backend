import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sequelize, User } from './models/index.js';
import authRoutes from './routes/auth.routes.js';
import triageRoutes from './routes/triage.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import patientRoutes from './routes/patient.routes.js';
import nurseRoutes from './routes/nurse.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

// CareLink backend server entry point
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Helmet to set security-related HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing with credentials support
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting for auth endpoints (brute-force mitigation)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production'
});

// Parse cookie headers
app.use(cookieParser());

// Parse incoming request JSON bodies
app.use(express.json());

// Apply rate limiter to auth endpoints
app.use('/api/auth', authLimiter);

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
app.use('/api/patients', patientRoutes);
app.use('/api/nurse', nurseRoutes);

// Global Error Handler
app.use(errorHandler);

// Seed default admin account
const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@carelink.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminCareLink2026!';

  try {
    const adminExists = await User.findOne({ where: { email: adminEmail } });
    if (!adminExists) {
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });
      console.log(`Default admin user seeded successfully: ${adminEmail}`);
    }
  } catch (err) {
    console.error('Failed to seed default admin user:', err);
  }
};

// Database Sync and Server Bootstrap
const startServer = async () => {
  try {
    const autoSyncEnabled = process.env.DB_AUTO_SYNC === 'true';

    if (autoSyncEnabled) {
      // Sync database only when explicitly enabled
      await sequelize.sync({ alter: true });
      console.log('Database synced successfully.');
    } else {
      await sequelize.authenticate();
      console.log('Database connection verified successfully.');
    }

    // Seed default admin
    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`CareLink backend server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start CareLink server:', error);
    process.exit(1);
  }
};

startServer();
