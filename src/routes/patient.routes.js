import express from 'express';
import {
  getPatients,
  getPatientProfile,
  updatePatientProfile,
  getPatientById,
  updatePatient,
  createCareStep,
  toggleCareStep,
  deleteCareStep,
  createHealthUpdate,
  getDoctors,
  getApprovedNurses,
  orderPatientAdmission,
  getNurseLogs,
  createNurseLog,
  acknowledgeNurseLog
} from '../controllers/patient.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, authorize('doctor', 'admin'), getPatients);
router.get('/profile', protect, authorize('patient'), getPatientProfile);
router.put('/profile', protect, authorize('patient'), updatePatientProfile);
router.get('/doctors', protect, getDoctors);
router.get('/nurses', protect, authorize('doctor', 'admin'), getApprovedNurses);
router.post('/admissions/order', protect, authorize('doctor'), orderPatientAdmission);
router.get('/nurse-logs', protect, authorize('doctor'), getNurseLogs);
router.post('/nurse-logs', protect, createNurseLog);
router.put('/nurse-logs/:logId/acknowledge', protect, authorize('doctor'), acknowledgeNurseLog);

router.get('/:id', protect, authorize('doctor', 'admin'), getPatientById);
router.put('/:id', protect, authorize('doctor', 'admin'), updatePatient);

router.post('/:id/care-steps', protect, authorize('doctor'), createCareStep);
router.put('/care-steps/:stepId', protect, toggleCareStep);
router.delete('/care-steps/:stepId', protect, authorize('doctor'), deleteCareStep);

router.post('/:id/health-updates', protect, authorize('doctor'), createHealthUpdate);

export default router;
