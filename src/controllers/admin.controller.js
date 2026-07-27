import { User, Patient, Doctor, Appointment, Symptom } from '../models/index.js';

// Simple in-memory/simulated logs for Hospital Admissions (Group 7)
// Since we don't need persistent admission table unless requested, we can use a mock list
// or keep it simple. Let's create a simulated structure.
const mockAdmissions = [
  { id: 'adm-1', patientName: 'John Doe', ward: 'B1', status: 'Admitted', admittedAt: '2026-06-30T10:00:00Z', nurseNotes: 'Stable condition' }
];

export const getSystemStats = async (req, res, next) => {
  try {
    const totalUsers = await User.count();
    const totalPatients = await Patient.count();
    const totalDoctors = await Doctor.count();
    const totalAppointments = await Appointment.count();
    const pendingTriages = await Symptom.count({ where: { status: 'Pending' } });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPatients,
        totalDoctors,
        totalAppointments,
        pendingTriages,
        activeAdmissions: mockAdmissions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdmissions = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: mockAdmissions
    });
  } catch (error) {
    next(error);
  }
};

export const createAdmission = async (req, res, next) => {
  try {
    const { patientName, ward, nurseNotes } = req.body;

    const newAdmission = {
      id: `adm-${mockAdmissions.length + 1}`,
      patientName,
      ward,
      status: 'Admitted',
      admittedAt: new Date().toISOString(),
      nurseNotes
    };

    mockAdmissions.push(newAdmission);

    res.status(201).json({
      success: true,
      data: newAdmission
    });
  } catch (error) {
    next(error);
  }
};

// Admin User Management
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Deleting the user will cascade delete Patient/Doctor profiles
    await user.destroy();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Admin Doctor Management
export const getAllDoctors = async (req, res, next) => {
  try {
    const doctors = await Doctor.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }]
    });
    res.json({ success: true, data: doctors });
  } catch (error) {
    next(error);
  }
};

export const updateDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const { specialization, licenseNumber, phone, availability } = req.body;
    await doctor.update({
      specialization: specialization ?? doctor.specialization,
      licenseNumber: licenseNumber ?? doctor.licenseNumber,
      phone: phone ?? doctor.phone,
      availability: availability ?? doctor.availability
    });

    res.json({ success: true, message: 'Doctor profile updated successfully', data: doctor });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Delete the underlying User as well
    const user = await User.findByPk(doctor.userId);
    if (user) {
      await user.destroy();
    } else {
      await doctor.destroy();
    }

    res.json({ success: true, message: 'Doctor deleted successfully' });
  } catch (error) {
    next(error);
  }
};
