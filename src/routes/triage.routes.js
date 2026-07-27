import express from 'express';
import multer from 'multer';
import {
  assessSymptoms,
  diagnoseSymptoms,
  getTriageHistory,
  recommendDoctors,
  getSymptoms,
  assessDocument,
  getAllTriageHistory,
  approveTriage,
  overrideTriage
} from '../controllers/triage.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.post('/assess', protect, authorize('patient'), assessSymptoms);
router.post('/diagnose', protect, authorize('patient'), diagnoseSymptoms);
router.post('/assess-document', protect, authorize('patient', 'doctor'), upload.single('document'), assessDocument);
router.get('/history', protect, authorize('patient'), getTriageHistory);
router.get('/recommend-doctors', protect, recommendDoctors);
router.get('/symptoms', getSymptoms); // No protect to allow easy frontend querying

// Doctor & Admin triage console controls
router.get('/history/all', protect, authorize('doctor', 'admin'), getAllTriageHistory);
router.put('/history/:id/approve', protect, authorize('doctor'), approveTriage);
router.put('/history/:id/override', protect, authorize('doctor'), overrideTriage);

export default router;
