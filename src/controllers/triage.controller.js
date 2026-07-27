import { Symptom, Patient, User, Doctor } from '../models/index.js';
import triageMlService from '../services/triageMl.service.js';
import supabase from '../config/supabase.js';
import geminiService from '../services/gemini.service.js';

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
      predictedDisease: assessment.predictedDisease,
    });
  } catch (error) {
    next(error);
  }
};

export const diagnoseSymptoms = async (req, res, next) => {
  try {
    const { symptoms, symptomsText } = req.body;
    const normalizedSymptoms = triageMlService.normalizeSymptoms(symptoms);

    if (normalizedSymptoms.length === 0 && !symptomsText) {
      return res.status(400).json({ success: false, message: 'Symptoms are required' });
    }

    const patient = await Patient.findOne({ where: { userId: req.user.id } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found for this user' });
    }

    const rawInput = normalizedSymptoms.length > 0 ? normalizedSymptoms : symptomsText;
    const assessment = await triageMlService.assessSymptomsFromInput(rawInput, normalizedSymptoms);
    const storedSymptomsText = normalizedSymptoms.length > 0 ? normalizedSymptoms.join(', ') : symptomsText;

    const symptomRecord = await Symptom.create({
      patientId: patient.id,
      symptomsText: storedSymptomsText,
      severityScore: assessment.severityScore,
      triagePriority: assessment.triagePriority,
      aiRecommendation: assessment.predictedDisease
        ? `${assessment.recommendation} Predicted disease: ${assessment.predictedDisease}.`
        : assessment.recommendation,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      data: symptomRecord,
      predictedDisease: assessment.predictedDisease,
      shouldVisitDoctor: assessment.shouldVisitDoctor,
      urgencyLevel: assessment.urgencyLevel,
      urgencyLabel: assessment.urgencyLabel,
      specialistType: assessment.specialistType,
      confidence: assessment.confidence,
      matchedSymptoms: assessment.matchedSymptoms,
    });
  } catch (error) {
    next(error);
  }
};

export const getSymptoms = async (req, res, next) => {
  try {
    const response = await fetch(`${triageMlService.mlServiceUrl}/symptoms`);
    if (!response.ok) {
        throw new Error('Failed to fetch symptoms from ML service');
    }
    const data = await response.json();
    res.json({
        success: true,
        data: data.symptoms,
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

export const assessDocument = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Document is required' });
    }

    // Retrieve patient profile of the logged-in user or doctor selection
    let patient;
    if (req.user.role === 'patient') {
      patient = await Patient.findOne({ where: { userId: req.user.id } });
    } else {
      patient = await Patient.findByPk(req.body.patientId);
    }
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // 1. Upload to Supabase Storage
    const bucketName = 'medical-documents';
    
    // Ensure the bucket exists (attempt creation or handle error)
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === bucketName)) {
        await supabase.storage.createBucket(bucketName, {
          public: true, // Make public so we can retrieve URLs
        });
      }
    } catch (bucketErr) {
      console.warn('Bucket ensure/creation failed or skipped:', bucketErr.message);
    }

    // Create a unique file name
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${patient.id}_${Date.now()}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ success: false, message: 'Failed to upload document to storage' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // 2. Parse document with Gemini AI to get symptoms/summary
    let geminiResult = null;
    try {
      geminiResult = await geminiService.analyzeDocument(file.buffer, file.mimetype);
    } catch (geminiErr) {
      console.warn('Gemini analysis failed:', geminiErr.message);
    }

    // 3. Extract symptoms & generate symptom description
    let symptomsList = [];
    let extractedSymptomsText = '';

    if (geminiResult && geminiResult.symptoms && geminiResult.symptoms.length > 0) {
      symptomsList = geminiResult.symptoms;
      extractedSymptomsText = geminiResult.summary || `Extracted symptoms: ${symptomsList.join(', ')}`;
    } else {
      // Fallback: If we couldn't parse the file contents using Gemini, extract symptoms from filename or use defaults
      const lowerName = file.originalname.toLowerCase();
      if (lowerName.includes('cough') || lowerName.includes('flu') || lowerName.includes('fever')) {
        symptomsList = ['cough', 'fever', 'runny nose'];
        extractedSymptomsText = 'Symptoms extracted from report name: cough, fever, runny nose.';
      } else if (lowerName.includes('heart') || lowerName.includes('cardio') || lowerName.includes('chest')) {
        symptomsList = ['chest pain', 'shortness of breath'];
        extractedSymptomsText = 'Symptoms extracted from report name: chest pain, shortness of breath.';
      } else if (lowerName.includes('diarrhea') || lowerName.includes('stomach') || lowerName.includes('vomit')) {
        symptomsList = ['vomiting', 'diarrhea', 'nausea', 'stomach pain'];
        extractedSymptomsText = 'Symptoms extracted from report name: vomiting, diarrhea, nausea, stomach pain.';
      } else {
        symptomsList = ['fever', 'headache'];
        extractedSymptomsText = `Uploaded document: ${file.originalname}. (Configure GEMINI_API_KEY for advanced AI document reading).`;
      }
    }

    // Combine user symptoms text with extracted text if provided
    const userSymptomsText = req.body.symptomsText || '';
    const finalSymptomsText = userSymptomsText 
      ? `${userSymptomsText}\n[Document Analysis: ${extractedSymptomsText}]`
      : extractedSymptomsText;

    // 4. Send the symptoms list to the ML service
    const assessment = await triageMlService.assessSymptomsFromInput(finalSymptomsText, symptomsList);

    // 5. Save the Symptom record including the document URL in the database
    const symptomRecord = await Symptom.create({
      patientId: patient.id,
      symptomsText: finalSymptomsText,
      severityScore: assessment.severityScore,
      triagePriority: assessment.triagePriority,
      aiRecommendation: assessment.predictedDisease
        ? `${assessment.recommendation} Predicted disease: ${assessment.predictedDisease}.`
        : assessment.recommendation,
      status: 'Pending',
      documentUrl: publicUrl,
    });

    res.status(201).json({
      success: true,
      data: symptomRecord,
      predictedDisease: assessment.predictedDisease,
      shouldVisitDoctor: assessment.shouldVisitDoctor,
      urgencyLevel: assessment.urgencyLevel,
      urgencyLabel: assessment.urgencyLabel,
      specialistType: assessment.specialistType,
      confidence: assessment.confidence,
      matchedSymptoms: assessment.matchedSymptoms,
      documentUrl: publicUrl,
      documentName: file.originalname,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTriageHistory = async (req, res, next) => {
  try {
    const history = await Symptom.findAll({
      include: [{
        model: Patient,
        include: [{ model: User, attributes: ['name', 'email'] }]
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

export const approveTriage = async (req, res, next) => {
  try {
    const symptom = await Symptom.findByPk(req.params.id);
    if (!symptom) {
      return res.status(404).json({ success: false, message: 'Triage record not found' });
    }
    const { doctorNotes } = req.body;
    symptom.status = 'Approved';
    if (doctorNotes) {
      symptom.aiRecommendation = `${symptom.aiRecommendation}\n\nClinical Decision Note: ${doctorNotes}`;
    }
    await symptom.save();
    res.json({ success: true, message: 'Triage approved successfully', data: symptom });
  } catch (error) {
    next(error);
  }
};

export const overrideTriage = async (req, res, next) => {
  try {
    const symptom = await Symptom.findByPk(req.params.id);
    if (!symptom) {
      return res.status(404).json({ success: false, message: 'Triage record not found' });
    }
    const { doctorNotes } = req.body;
    symptom.status = 'Overridden';
    if (doctorNotes) {
      symptom.aiRecommendation = `${symptom.aiRecommendation}\n\nOverride Justification Note: ${doctorNotes}`;
    }
    await symptom.save();
    res.json({ success: true, message: 'Triage overridden successfully', data: symptom });
  } catch (error) {
    next(error);
  }
};
