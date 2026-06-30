import { Appointment, Prescription, Patient, Doctor, User } from '../models/index.js';

export const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, timeSlot, notes } = req.body;

    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appointment = await Appointment.create({
      patientId: patient.id,
      doctorId,
      appointmentDate,
      timeSlot,
      notes,
      status: 'Scheduled',
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointments = async (req, res, next) => {
  try {
    let appointments;

    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

      appointments = await Appointment.findAll({
        where: { patientId: patient.id },
        include: [
          {
            model: Doctor,
            include: [{ model: User, attributes: ['name', 'email'] }]
          }
        ]
      });
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

      appointments = await Appointment.findAll({
        where: { doctorId: doctor.id },
        include: [
          {
            model: Patient,
            include: [{ model: User, attributes: ['name', 'email'] }]
          }
        ]
      });
    } else {
      // Admins / Nurses can see all appointments
      appointments = await Appointment.findAll({
        include: [
          { model: Patient, include: [{ model: User, attributes: ['name'] }] },
          { model: Doctor, include: [{ model: User, attributes: ['name'] }] }
        ]
      });
    }

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

export const writePrescription = async (req, res, next) => {
  try {
    const { appointmentId, medicines, dosageInstructions } = req.body;

    const appointment = await Appointment.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
    if (!doctor || appointment.doctorId !== doctor.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to prescribe for this appointment' });
    }

    const prescription = await Prescription.create({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: doctor.id,
      medicines,
      dosageInstructions,
      status: 'Issued'
    });

    // Update appointment status to Completed
    appointment.status = 'Completed';
    await appointment.save();

    res.status(201).json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
};

export const getPrescriptions = async (req, res, next) => {
  try {
    let prescriptions;

    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ where: { userId: req.user.id } });
      if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

      prescriptions = await Prescription.findAll({
        where: { patientId: patient.id },
        include: [{ model: Doctor, include: [{ model: User, attributes: ['name'] }] }]
      });
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

      prescriptions = await Prescription.findAll({
        where: { doctorId: doctor.id },
        include: [{ model: Patient, include: [{ model: User, attributes: ['name'] }] }]
      });
    } else {
      prescriptions = await Prescription.findAll({
        include: [
          { model: Patient, include: [{ model: User, attributes: ['name'] }] },
          { model: Doctor, include: [{ model: User, attributes: ['name'] }] }
        ]
      });
    }

    res.json({
      success: true,
      data: prescriptions,
    });
  } catch (error) {
    next(error);
  }
};
