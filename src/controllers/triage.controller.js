import { Symptom, Patient, User, Doctor } from '../models/index.js';
import triageMlService from '../services/triageMl.service.js';

export const assessSymptoms = async (req, res, next) => {
  try {
    const { symptomsText } = req.body;

    if (!symptomsText) {
      return res.status(400).json({ success: false, message: 'Symptoms description is required' });
    }

    // Retrieve patient profile of the logged-in user
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found for this user' });
    }

    // Call ML service (currently mock)
    const assessment = await triageMlService.assessSymptoms(symptomsText);

    // Save to database
    const symptomRecord = await Symptom.create({
      patientId: patient.id,
      symptomsText,
      severityScore: assessment.severityScore,
      triagePriority: assessment.triagePriority,
      aiRecommendation: assessment.recommendation,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      data: symptomRecord,
    });
  } catch (error) {
    next(error);
  }
};

export const getTriageHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const history = await Symptom.findAll({
      where: { patientId: patient.id },
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

export const recommendDoctors = async (req, res, next) => {
  try {
    const { symptomsText } = req.query;
    let specialization = 'General Practitioner';

    if (symptomsText) {
      const text = symptomsText.toLowerCase();
      if (text.includes('chest') || text.includes('heart') || text.includes('cardio')) {
        specialization = 'Cardiologist';
      } else if (text.includes('child') || text.includes('kid') || text.includes('pediatric')) {
        specialization = 'Pediatrician';
      } else if (text.includes('skin') || text.includes('rash') || text.includes('dermatology')) {
        specialization = 'Dermatologist';
      } else if (text.includes('bone') || text.includes('joint') || text.includes('fracture') || text.includes('ortho')) {
        specialization = 'Orthopedist';
      } else if (text.includes('eye') || text.includes('vision') || text.includes('ophthalmology')) {
        specialization = 'Ophthalmologist';
      }
    }

    const doctors = await Doctor.findAll({
      where: { specialization },
      include: [{ model: User, attributes: ['name', 'email'] }]
    });

    // If no matching specialist found, return all available doctors as fallback
    if (doctors.length === 0) {
      const fallbackDoctors = await Doctor.findAll({
        include: [{ model: User, attributes: ['name', 'email'] }]
      });
      return res.json({
        success: true,
        recommendedSpecialization: 'General fallback',
        data: fallbackDoctors,
      });
    }

    res.json({
      success: true,
      recommendedSpecialization: specialization,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};
