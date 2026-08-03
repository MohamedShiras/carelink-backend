import express from 'express';
import multer from 'multer';
import { registerUser, registerDoctor, registerNurse, loginUser, logoutUser, getUserProfile, updateDoctorProfile } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB file limit

router.post('/register', registerUser);
router.post(
  '/register-doctor',
  upload.fields([
    { name: 'nicFront', maxCount: 1 },
    { name: 'nicBack', maxCount: 1 },
    { name: 'medicalLicense', maxCount: 1 }
  ]),
  registerDoctor
);
router.post(
  '/register-nurse',
  upload.fields([
    { name: 'nicFront', maxCount: 1 },
    { name: 'nicBack', maxCount: 1 },
    { name: 'nursingLicense', maxCount: 1 },
    { name: 'cvDocument', maxCount: 1 }
  ]),
  registerNurse
);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/profile', protect, getUserProfile);
router.put('/doctor-profile', protect, updateDoctorProfile);

export default router;
