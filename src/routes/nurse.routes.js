import express from 'express';
import {
  getNurseAdmissions,
  confirmNurseAdmission,
  recordNurseVitals,
  dischargeNurseAdmission
} from '../controllers/nurse.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect, authorize('nurse'));

router.get('/admissions', getNurseAdmissions);
router.put('/admissions/:id/confirm', confirmNurseAdmission);
router.post('/vitals', recordNurseVitals);
router.put('/admissions/:id/discharge', dischargeNurseAdmission);

export default router;
