import { Admission, Nurse, Patient, User, NurseLog } from '../models/index.js';

export const getNurseAdmissions = async (req, res, next) => {
  try {
    const nurse = await Nurse.findOne({ where: { userId: req.user.id } });
    if (!nurse) {
      return res.status(404).json({ success: false, message: 'Nurse profile not found' });
    }

    const admissions = await Admission.findAll({
      order: [['admittedAt', 'DESC']]
    });

    // Filter admissions assigned to this nurse or unassigned
    const nurseAdmissions = admissions.filter(a => !a.assignedNurseId || a.assignedNurseId === nurse.id);

    res.json({
      success: true,
      data: nurseAdmissions,
      nurseProfile: {
        id: nurse.id,
        name: req.user.name,
        department: nurse.department,
        licenseNumber: nurse.licenseNumber
      }
    });
  } catch (error) {
    next(error);
  }
};

export const confirmNurseAdmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ward, nurseNotes } = req.body;

    const admission = await Admission.findByPk(id);
    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission record not found' });
    }

    const nurse = await Nurse.findOne({ where: { userId: req.user.id } });

    admission.status = 'Admitted';
    if (ward) admission.ward = ward;
    if (nurseNotes) admission.nurseNotes = nurseNotes;
    if (nurse) {
      admission.assignedNurseId = nurse.id;
      admission.assignedNurseName = req.user.name;
    }
    await admission.save();

    res.json({
      success: true,
      message: 'Patient bed admission confirmed successfully!',
      data: admission
    });
  } catch (error) {
    next(error);
  }
};

export const recordNurseVitals = async (req, res, next) => {
  try {
    const { patientId, bloodPressure, pulseRate, temperature, spO2, notes, isEscalation } = req.body;

    const nurse = await Nurse.findOne({ where: { userId: req.user.id } });

    const vitalsText = `BP: ${bloodPressure || '120/80'} | Pulse: ${pulseRate || '75'} bpm | Temp: ${temperature || '98.6'}°F | SpO2: ${spO2 || '98'}%`;
    const fullNotes = notes ? `${vitalsText} — ${notes}` : vitalsText;

    const newLog = await NurseLog.create({
      patientId: patientId || null,
      nurseId: nurse?.id || null,
      nurseName: req.user.name || 'Staff Nurse',
      vitalsNotes: fullNotes,
      escalated: !!isEscalation,
      escalationStatus: isEscalation ? 'High Priority' : 'Normal',
      loggedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Patient vitals and nursing log recorded successfully!',
      data: newLog
    });
  } catch (error) {
    next(error);
  }
};

export const dischargeNurseAdmission = async (req, res, next) => {
  try {
    const { id } = req.params;

    const admission = await Admission.findByPk(id);
    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission record not found' });
    }

    admission.status = 'Discharged';
    await admission.save();

    res.json({
      success: true,
      message: 'Patient hospital discharge completed.',
      data: admission
    });
  } catch (error) {
    next(error);
  }
};
