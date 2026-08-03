import { User, Patient, Doctor, Nurse, Appointment, Symptom, Admission } from '../models/index.js';

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
        activeAdmissions: await Admission.count({ where: { status: 'Admitted' } })
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdmissions = async (req, res, next) => {
  try {
    const admissions = await Admission.findAll({
      order: [['admittedAt', 'DESC']]
    });

    res.json({
      success: true,
      data: admissions
    });
  } catch (error) {
    next(error);
  }
};

export const createAdmission = async (req, res, next) => {
  try {
    const { patientId, patientName, ward, nurseNotes } = req.body;

    const newAdmission = await Admission.create({
      patientId: patientId || null,
      patientName,
      ward,
      status: 'Admitted',
      admittedAt: new Date(),
      nurseNotes
    });

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

export const approveDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    doctor.status = 'Approved';
    doctor.rejectionReason = null;
    await doctor.save();

    res.json({
      success: true,
      message: 'Doctor credential request approved! Clinician can now sign in.',
      data: doctor
    });
  } catch (error) {
    next(error);
  }
};

export const rejectDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const { reason } = req.body;
    doctor.status = 'Rejected';
    doctor.rejectionReason = reason || 'Credentials failed verification.';
    await doctor.save();

    res.json({
      success: true,
      message: 'Doctor credential request rejected.',
      data: doctor
    });
  } catch (error) {
    next(error);
  }
};

// Admin Nurse Management
export const getAllNurses = async (req, res, next) => {
  try {
    const nurses = await Nurse.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }]
    });
    res.json({ success: true, data: nurses });
  } catch (error) {
    next(error);
  }
};

export const approveNurse = async (req, res, next) => {
  try {
    const nurse = await Nurse.findByPk(req.params.id);
    if (!nurse) {
      return res.status(404).json({ success: false, message: 'Nurse profile not found' });
    }

    nurse.status = 'Approved';
    nurse.rejectionReason = null;
    await nurse.save();

    res.json({
      success: true,
      message: 'Nurse credential request approved! Nurse can now access the console.',
      data: nurse
    });
  } catch (error) {
    next(error);
  }
};

export const rejectNurse = async (req, res, next) => {
  try {
    const nurse = await Nurse.findByPk(req.params.id);
    if (!nurse) {
      return res.status(404).json({ success: false, message: 'Nurse profile not found' });
    }

    const { reason } = req.body;
    nurse.status = 'Rejected';
    nurse.rejectionReason = reason || 'Credentials / CV failed verification.';
    await nurse.save();

    res.json({
      success: true,
      message: 'Nurse credential request rejected.',
      data: nurse
    });
  } catch (error) {
    next(error);
  }
};
