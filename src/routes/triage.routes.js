import express from 'express';
import { assessSymptoms, diagnoseSymptoms, getTriageHistory, recommendDoctors, getSymptoms } from '../controllers/triage.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/assess', protect, authorize('patient'), assessSymptoms);
router.post('/diagnose', protect, authorize('patient'), diagnoseSymptoms);
router.get('/history', protect, authorize('patient'), getTriageHistory);
router.get('/recommend-doctors', protect, recommendDoctors);
router.get('/symptoms', getSymptoms); // No protect to allow easy frontend querying

export default router;
