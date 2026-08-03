import express from 'express';
import multer from 'multer';
import {
  createAppointment,
  getAppointments,
  writePrescription,
  getPrescriptions,
  uploadAppointmentReport
} from '../controllers/appointment.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.post('/', protect, authorize('patient'), createAppointment);
router.post('/:id/report', protect, authorize('patient'), upload.single('report'), uploadAppointmentReport);
router.get('/', protect, getAppointments);

router.post('/prescription', protect, authorize('doctor'), writePrescription);
router.get('/prescriptions', protect, getPrescriptions);

export default router;
