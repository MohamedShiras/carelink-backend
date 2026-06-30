import express from 'express';
import { assessSymptoms, getTriageHistory, recommendDoctors } from '../controllers/triage.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/assess', protect, authorize('patient'), assessSymptoms);
router.get('/history', protect, authorize('patient'), getTriageHistory);
router.get('/recommend-doctors', protect, recommendDoctors);

export default router;
