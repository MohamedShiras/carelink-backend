import { Patient, User, CareStep, HealthUpdate, NurseLog, Appointment, Prescription } from '../models/index.js';

// Get list of all patients (Doctors and Admins only)
export const getPatients = async (req, res, next) => {
  try {
    const patients = await Patient.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }]
    });

    res.json({
      success: true,
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

// Get profile of logged-in patient (and seed default steps/updates if empty)
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

    // Auto-seed default care steps if empty
    if (!patient.CareSteps || patient.CareSteps.length === 0) {
      const defaultSteps = [
        { patientId: patient.id, text: 'Check blood pressure every morning', done: true },
        { patientId: patient.id, text: 'Upload symptoms if they change', done: false },
        { patientId: patient.id, text: 'Complete the follow-up blood test', done: false },
        { patientId: patient.id, text: 'Review diet notes with the care team', done: false }
      ];
      const createdSteps = await CareStep.bulkCreate(defaultSteps);
      patient.setDataValue('CareSteps', createdSteps);
    }

    // Auto-seed default health updates if empty
    if (!patient.HealthUpdates || patient.HealthUpdates.length === 0) {
      const defaultUpdates = [
        { patientId: patient.id, title: 'Lab results reviewed', detail: 'Kidney markers remain within the expected recovery range.', time: 'Today, 07:20 AM', dotColor: '#10b981' },
        { patientId: patient.id, title: 'Nurse check-in completed', detail: 'Blood pressure and symptom notes were logged successfully.', time: 'Yesterday, 06:10 PM', dotColor: '#3b82f6' },
        { patientId: patient.id, title: 'Medication reminder sent', detail: 'Evening dose reminder scheduled for 8:00 PM.', time: 'Yesterday, 05:15 PM', dotColor: '#8b5cf6' }
      ];
      const createdUpdates = await HealthUpdate.bulkCreate(defaultUpdates);
      patient.setDataValue('HealthUpdates', createdUpdates);
    }

    // Fetch associated appointments
    const appointments = await Appointment.findAll({
      where: { patientId: patient.id },
      include: [{ model: User, attributes: ['name', 'email'] }]
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
    const doctors = await User.findAll({
      where: { role: 'doctor' },
      attributes: ['id', 'name', 'email'],
      include: [{ model: Patient, required: false }] // In case of doctor relationships
    });

    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    next(error);
  }
};

// Get Nurse Logs (and auto-seed defaults if database table is empty)
export const getNurseLogs = async (req, res, next) => {
  try {
    let logs = await NurseLog.findAll({
      order: [['createdAt', 'DESC']]
    });

    // Auto-seed default nurse logs if empty
    if (logs.length === 0) {
      // Find a patient in database to link the logs to (if any exists)
      const testPatient = await Patient.findOne();
      const patientId = testPatient ? testPatient.id : '00000000-0000-0000-0000-000000000000';
      const patientName = testPatient ? (await User.findByPk(testPatient.userId))?.name : 'Sarah Jenkins';

      const defaultLogs = [
        {
          patientId,
          patientName: patientName || 'Sarah Jenkins',
          vitals: 'BP: 158/92, HR: 78 bpm, Temp: 98.4 F, SpO2: 97%',
          notes: 'Patient complains of mild headache. Input/Output fluid chart is being monitored closely. Low urine output logged.',
          loggedBy: 'Nurse Jessica Smith',
          loggedAt: '2026-06-15 11:30',
          escalated: false,
          escalationStatus: 'Normal'
        },
        {
          patientId,
          patientName: patientName || 'David Miller',
          vitals: 'BP: 102/64, HR: 98 bpm, Temp: 99.1 F, SpO2: 95%',
          notes: 'Chest tube drainage logged at 40ml. Patient reports chest pain level 6/10; analgesics administered. Alerted doctor due to pain elevation.',
          loggedBy: 'Nurse Jessica Smith',
          loggedAt: '2026-06-15 12:15',
          escalated: true,
          escalationStatus: 'Critical'
        }
      ];
      logs = await NurseLog.bulkCreate(defaultLogs);
    }

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
