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
