import { Patient, User, Doctor, Nurse, CareStep, HealthUpdate, NurseLog, Appointment, Prescription, Admission } from '../models/index.js';

// Get list of patients (Scoped by doctor appointments if role is doctor)
export const getPatients = async (req, res, next) => {
  try {
    let patients;

    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
      if (!doctor) {
        return res.json({ success: true, data: [] });
      }

      // Fetch appointments for this doctor to find associated patients
      const appointments = await Appointment.findAll({
        where: { doctorId: doctor.id },
        attributes: ['patientId']
      });

      const patientIds = [...new Set(appointments.map(a => a.patientId).filter(Boolean))];

      if (patientIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      patients = await Patient.findAll({
        where: { id: patientIds },
        include: [{ model: User, attributes: ['name', 'email'] }]
      });
    } else {
      // Admins and Nurses can see all patients
      patients = await Patient.findAll({
        include: [{ model: User, attributes: ['name', 'email'] }]
      });
    }

    res.json({
      success: true,
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

// Get profile of logged-in patient
export const getPatientProfile = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [
        { model: User, attributes: ['name', 'email'] },
        { model: CareStep },
        { model: HealthUpdate }
      ]
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // Fetch associated appointments
    const appointments = await Appointment.findAll({
      where: { patientId: patient.id },
      include: [
        {
          model: Doctor,
          include: [{ model: User, attributes: ['name', 'email'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Fetch associated prescriptions
    const prescriptions = await Prescription.findAll({
      where: { patientId: patient.id }
    });

    res.json({
      success: true,
      data: patient,
      appointments,
      prescriptions
    });
  } catch (error) {
    next(error);
  }
};

// Update logged-in patient profile details
export const updatePatientProfile = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({
      where: { userId: req.user.id }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const {
      name,
      age,
      gender,
      bloodType,
      phone,
      address,
      medicalHistory
    } = req.body;

    if (typeof name === 'string' && name.trim()) {
      await User.update({ name: name.trim() }, { where: { id: req.user.id } });
    }

    await Patient.update({
      age: age ?? patient.age,
      gender: gender ?? patient.gender,
      bloodType: bloodType ?? patient.bloodType,
      phone: phone ?? patient.phone,
      address: address ?? patient.address,
      medicalHistory: medicalHistory ?? patient.medicalHistory
    }, {
      where: { id: patient.id }
    });

    const refreshedPatient = await Patient.findOne({
      where: { userId: req.user.id },
      include: [
        { model: User, attributes: ['id', 'name', 'email'] },
        { model: CareStep },
        { model: HealthUpdate }
      ]
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: refreshedPatient
    });
  } catch (error) {
    next(error);
  }
};

// Get specific patient details (attending doctor check)
export const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ['name', 'email'] },
        { model: CareStep },
        { model: HealthUpdate }
      ]
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// Update patient stats/demographics (Doctors/Admins only)
export const updatePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const {
      age, gender, bloodType, phone, address, medicalHistory,
      wellbeingStatus, healthSummary, medicationAdherence,
      activeAlertsCount, alertDetail, diagnosis, allergies, warnings, room, status
    } = req.body;

    await patient.update({
      age: age ?? patient.age,
      gender: gender ?? patient.gender,
      bloodType: bloodType ?? patient.bloodType,
      phone: phone ?? patient.phone,
      address: address ?? patient.address,
      medicalHistory: medicalHistory ?? patient.medicalHistory,
      wellbeingStatus: wellbeingStatus ?? patient.wellbeingStatus,
      healthSummary: healthSummary ?? patient.healthSummary,
      medicationAdherence: medicationAdherence ?? patient.medicationAdherence,
      activeAlertsCount: activeAlertsCount ?? patient.activeAlertsCount,
      alertDetail: alertDetail ?? patient.alertDetail,
      diagnosis: diagnosis ?? patient.diagnosis,
      allergies: allergies ?? patient.allergies,
      warnings: warnings ?? patient.warnings,
      room: room ?? patient.room,
      status: status ?? patient.status
    });

    res.json({
      success: true,
      message: 'Patient profile updated successfully',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// Add Care Checklist Step (Doctors only)
export const createCareStep = async (req, res, next) => {
  try {
    const { id } = req.params; // patientId
    const { text, done } = req.body;

    const step = await CareStep.create({
      patientId: id,
      text,
      done: done ?? false
    });

    res.status(201).json({
      success: true,
      data: step
    });
  } catch (error) {
    next(error);
  }
};

// Toggle Care Checklist Step
export const toggleCareStep = async (req, res, next) => {
  try {
    const { stepId } = req.params;
    const step = await CareStep.findByPk(stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Care step not found' });
    }

    step.done = !step.done;
    await step.save();

    res.json({
      success: true,
      data: step
    });
  } catch (error) {
    next(error);
  }
};

// Delete Care Checklist Step (Doctors only)
export const deleteCareStep = async (req, res, next) => {
  try {
    const { stepId } = req.params;
    const step = await CareStep.findByPk(stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Care step not found' });
    }

    await step.destroy();

    res.json({
      success: true,
      message: 'Care step deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add Health Timeline Update (Doctors only)
export const createHealthUpdate = async (req, res, next) => {
  try {
    const { id } = req.params; // patientId
    const { title, detail, time, dotColor } = req.body;

    const update = await HealthUpdate.create({
      patientId: id,
      title,
      detail,
      time: time || new Date().toLocaleString(),
      dotColor: dotColor || '#10b981'
    });

    res.status(201).json({
      success: true,
      data: update
    });
  } catch (error) {
    next(error);
  }
};

// Get List of All Doctors (accessible by Patients for Care Team / Booking)
export const getDoctors = async (req, res, next) => {
  try {
    const doctors = await Doctor.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }]
    });

    const formattedDoctors = doctors.map(d => ({
      id: d.id,
      userId: d.userId,
      name: d.User?.name || 'Doctor',
      specialization: d.specialization || 'General Medicine',
      availability: d.availability
    }));

    res.json({
      success: true,
      data: formattedDoctors
    });
  } catch (error) {
    next(error);
  }
};

// Get Nurse Logs
export const getNurseLogs = async (req, res, next) => {
  try {
    const logs = await NurseLog.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// Create a new Nurse Log entry
export const createNurseLog = async (req, res, next) => {
  try {
    const { patientId, patientName, vitals, notes, escalated, escalationStatus } = req.body;

    const log = await NurseLog.create({
      patientId,
      patientName,
      vitals,
      notes,
      loggedBy: req.user.name || 'Nurse Jessica Smith',
      loggedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      escalated: escalated ?? false,
      escalationStatus: escalationStatus || 'Normal'
    });

    res.status(201).json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
};

// Acknowledge Nurse Escalation Alert (Doctors only)
export const acknowledgeNurseLog = async (req, res, next) => {
  try {
    const { logId } = req.params;
    const log = await NurseLog.findByPk(logId);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Nurse log not found' });
    }

    log.escalated = false;
    log.escalationStatus = 'Acknowledged';
    await log.save();

    res.json({
      success: true,
      message: 'Escalation alert acknowledged successfully',
      data: log
    });
  } catch (error) {
    next(error);
  }
};

export const getApprovedNurses = async (req, res, next) => {
  try {
    const nurses = await Nurse.findAll({
      where: { status: 'Approved' },
      include: [{ model: User, attributes: ['name', 'email'] }]
    });

    const activeAdmissions = await Admission.findAll({
      where: {
        status: ['Admission Ordered', 'Admitted']
      }
    });

    const nurseCounts = {};
    activeAdmissions.forEach(adm => {
      if (adm.assignedNurseId) {
        nurseCounts[adm.assignedNurseId] = (nurseCounts[adm.assignedNurseId] || 0) + 1;
      }
    });

    const availableNurses = nurses
      .map(n => {
        const count = nurseCounts[n.id] || 0;
        return {
          id: n.id,
          userId: n.userId,
          name: n.User?.name || 'Nurse',
          department: n.department || 'General Ward',
          phone: n.phone,
          activePatientsCount: count,
          capacityLabel: `${n.User?.name || 'Nurse'} (${count}/2 Patients Active - ${n.department})`
        };
      })
      .filter(n => n.activePatientsCount < 2);

    res.json({ success: true, data: availableNurses });
  } catch (error) {
    next(error);
  }
};

export const orderPatientAdmission = async (req, res, next) => {
  try {
    const { patientId, patientName, ward, assignedNurseId, assignedNurseName, admissionReason } = req.body;

    if (assignedNurseId) {
      const activeCount = await Admission.count({
        where: {
          assignedNurseId,
          status: ['Admission Ordered', 'Admitted']
        }
      });

      if (activeCount >= 2) {
        return res.status(400).json({
          success: false,
          message: 'The selected nurse has reached maximum capacity (2 active patients). Please choose another nurse.'
        });
      }
    }

    const doctor = await Doctor.findOne({ where: { userId: req.user.id } });

    const newAdmission = await Admission.create({
      patientId: patientId || null,
      patientName: patientName || 'Patient',
      ward: ward || 'Ward 1A',
      status: 'Admission Ordered',
      doctorId: doctor?.id || null,
      doctorName: req.user.name || 'Attending Doctor',
      assignedNurseId: assignedNurseId || null,
      assignedNurseName: assignedNurseName || 'Assigned Nurse',
      admissionReason: admissionReason || 'Doctor Ordered Hospital Admission',
      admittedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Hospital admission order sent to Nurse Console!',
      data: newAdmission
    });
  } catch (error) {
    next(error);
  }
};
