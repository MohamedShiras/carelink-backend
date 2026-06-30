import express from 'express';
import {
  createAppointment,
  getAppointments,
  writePrescription,
  getPrescriptions
} from '../controllers/appointment.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('patient'), createAppointment);
router.get('/', protect, getAppointments);

router.post('/prescription', protect, authorize('doctor'), writePrescription);
router.get('/prescriptions', protect, getPrescriptions);

export default router;
