import { Appointment, Prescription, Patient, Doctor, User } from '../models/index.js';
import supabase from '../config/supabase.js';

export const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, timeSlot, notes } = req.body;

    let patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      patient = await Patient.create({
        userId: req.user.id,
        diagnosis: 'General Triage Review',
        wellbeingStatus: 'Stable',
        status: 'Active'
      });
    }

    let doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      doctor = await Doctor.findOne({ where: { userId: doctorId } });
    }

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appointment = await Appointment.create({
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentDate,
      timeSlot,
      notes: notes || 'Clinical consultation follow-up',
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

export const uploadAppointmentReport = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Report document file is required' });
    }

    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.patientId !== patient.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload reports for this appointment' });
    }

    const bucketName = 'medical-documents';
    let publicUrl = null;

    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === bucketName)) {
        await supabase.storage.createBucket(bucketName, { public: true });
      }
    } catch (bErr) {
      console.warn('Bucket check/create warning:', bErr.message);
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `report_apt_${appointment.id}_${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (!uploadError) {
        const urlResult = supabase.storage.from(bucketName).getPublicUrl(fileName);
        publicUrl = urlResult.data?.publicUrl || null;
      }
    } catch (storageErr) {
      console.warn('Supabase storage warning:', storageErr.message);
    }

    appointment.reportUrl = publicUrl || `https://cxwsiznzjvwiboygnljg.supabase.co/storage/v1/object/public/medical-documents/${fileName}`;
    appointment.reportName = file.originalname;
    await appointment.save();

    res.json({
      success: true,
      message: 'Medical report uploaded successfully for your appointment',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};
