import express from 'express';
import {
  getSystemStats,
  getAdmissions,
  createAdmission,
  getAllUsers,
  deleteUser,
  getAllDoctors,
  updateDoctor,
  deleteDoctor
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats', protect, authorize('admin'), getSystemStats);
router.get('/admissions', protect, authorize('nurse', 'admin'), getAdmissions);
router.post('/admissions', protect, authorize('nurse'), createAdmission);

// Admin User Controls
router.get('/users', protect, authorize('admin'), getAllUsers);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

// Admin Doctor Controls
router.get('/doctors', protect, authorize('admin'), getAllDoctors);
router.put('/doctors/:id', protect, authorize('admin'), updateDoctor);
router.delete('/doctors/:id', protect, authorize('admin'), deleteDoctor);

export default router;
