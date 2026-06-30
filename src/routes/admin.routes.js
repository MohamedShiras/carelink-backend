import express from 'express';
import { getSystemStats, getAdmissions, createAdmission } from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats', protect, authorize('admin'), getSystemStats);
router.get('/admissions', protect, authorize('nurse', 'admin'), getAdmissions);
router.post('/admissions', protect, authorize('nurse'), createAdmission);

export default router;
