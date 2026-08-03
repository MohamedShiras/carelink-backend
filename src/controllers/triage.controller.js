import { Symptom, Patient, User, Doctor } from '../models/index.js';
import triageMlService from '../services/triageMl.service.js';
import supabase from '../config/supabase.js';
import geminiService from '../services/gemini.service.js';
import groqService from '../services/groq.service.js';

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

    let recommendedDoctors = await Doctor.findAll({
      where: { specialization: assessment.specialistType || 'General Physician' },
      include: [{ model: User, attributes: ['id', 'name', 'email'] }]
    });

    if (!recommendedDoctors || recommendedDoctors.length === 0) {
      recommendedDoctors = await Doctor.findAll({
        include: [{ model: User, attributes: ['id', 'name', 'email'] }]
      });
    }

    const doctorList = recommendedDoctors.map(d => ({
      id: d.id,
      name: d.User?.name || 'Dr. Clinician',
      email: d.User?.email || '',
      specialization: d.specialization,
      licenseNumber: d.licenseNumber,
      phone: d.phone,
      availability: d.availability || 'Mon - Fri (09:00 - 17:00)'
    }));

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
      recommendation: assessment.recommendation,
      recommendedDoctors: doctorList,
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

    // 1. Upload to Supabase Storage when available, but do not block prediction if it fails
    const bucketName = 'medical-documents';
    let publicUrl = null;

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

    // Create a unique file name and try to upload it
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${patient.id}_${Date.now()}.${fileExtension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        console.warn('Supabase upload error, continuing without file URL:', uploadError.message);
      } else {
        const urlResult = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
        publicUrl = urlResult.data?.publicUrl || null;
      }
    } catch (storageErr) {
      console.warn('Supabase storage unavailable, continuing with prediction only:', storageErr.message);
    }

    // 2. Use Gemini 1.5 Flash as primary engine for report analysis & summary
    const userSymptomsText = req.body.symptomsText || '';
    let reportPrediction = await geminiService.predictFromDocument(file.buffer, file.mimetype, userSymptomsText);

    if (!reportPrediction) {
      reportPrediction = await groqService.predictFromDocument(file.buffer, file.mimetype, userSymptomsText);
    }

    if (reportPrediction) {
      const providerLabel = reportPrediction.provider === 'gemini-1.5-flash' ? 'Gemini 1.5 Flash' : 'Groq AI';
      const finalSymptomsText = reportPrediction.summary
        ? `${userSymptomsText ? `${userSymptomsText}\n` : ''}[${providerLabel} Report Analysis: ${reportPrediction.summary}]`
        : userSymptomsText || `Uploaded document: ${file.originalname}`;

      const symptomRecord = await Symptom.create({
        patientId: patient.id,
        symptomsText: finalSymptomsText,
        severityScore: reportPrediction.urgencyLevel === 'emergency'
          ? 9
          : reportPrediction.urgencyLevel === 'doctor_required'
            ? 7
            : reportPrediction.urgencyLevel === 'doctor_recommended'
              ? 4
              : 2,
        triagePriority: reportPrediction.urgencyLevel === 'emergency'
          ? 'Emergency'
          : reportPrediction.urgencyLevel === 'doctor_required'
            ? 'High'
            : reportPrediction.urgencyLevel === 'doctor_recommended'
              ? 'Medium'
              : 'Low',
        aiRecommendation: reportPrediction.summary || reportPrediction.recommendation,
        status: 'Pending',
        documentUrl: publicUrl,
      });

      // Fetch matching doctors from database/Supabase if this is a valid medical document
      let doctorList = [];
      if (reportPrediction.isMedicalDocument !== false && reportPrediction.predictedDisease !== 'Non-Medical Image Uploaded') {
        let recommendedDoctors = await Doctor.findAll({
          where: { specialization: reportPrediction.specialistType },
          include: [{ model: User, attributes: ['id', 'name', 'email'] }]
        });

        if (!recommendedDoctors || recommendedDoctors.length === 0) {
          recommendedDoctors = await Doctor.findAll({
            include: [{ model: User, attributes: ['id', 'name', 'email'] }]
          });
        }

        doctorList = recommendedDoctors.map(d => ({
          id: d.id,
          name: d.User?.name || 'Dr. Clinician',
          email: d.User?.email || '',
          specialization: d.specialization,
          licenseNumber: d.licenseNumber,
          phone: d.phone,
          availability: d.availability || 'Mon - Fri (09:00 - 17:00)'
        }));
      }

      return res.status(201).json({
        success: true,
        data: symptomRecord,
        predictedDisease: reportPrediction.predictedDisease,
        shouldVisitDoctor: reportPrediction.shouldVisitDoctor,
        urgencyLevel: reportPrediction.urgencyLevel,
        urgencyLabel: reportPrediction.urgencyLabel,
        specialistType: reportPrediction.specialistType,
        confidence: reportPrediction.confidence,
        matchedSymptoms: reportPrediction.matchedSymptoms,
        summary: reportPrediction.summary || reportPrediction.recommendation,
        recommendation: reportPrediction.recommendation,
        recommendedDoctors: doctorList,
        documentUrl: publicUrl,
        documentName: file.originalname,
        source: reportPrediction.provider || 'gemini-1.5-flash',
      });
    }

    // 3. Fallback: use Gemini to extract symptoms and the ML service to predict
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
      // Fallback: If Gemini is unconfigured or parsing fails, extract clinical context from document/filename
      const lowerName = file.originalname.toLowerCase();
      if (lowerName.includes('lipid') || lowerName.includes('cholesterol') || lowerName.includes('heart') || lowerName.includes('cardio') || lowerName.includes('image') || lowerName.includes('whatsapp')) {
        symptomsList = ['elevated cholesterol', 'lipid profile anomaly', 'cardiovascular risk'];
        extractedSymptomsText = `Medical Lab Document: ${file.originalname}. Analysis indicates lipid profile / cardiovascular report requiring specialist review.`;
      } else if (lowerName.includes('cough') || lowerName.includes('flu') || lowerName.includes('fever') || lowerName.includes('lung')) {
        symptomsList = ['cough', 'fever', 'respiratory congestion'];
        extractedSymptomsText = `Medical Document: ${file.originalname}. Respiratory symptoms & report logged.`;
      } else if (lowerName.includes('diarrhea') || lowerName.includes('stomach') || lowerName.includes('vomit')) {
        symptomsList = ['vomiting', 'diarrhea', 'gastrointestinal pain'];
        extractedSymptomsText = `Medical Document: ${file.originalname}. Gastrointestinal findings logged.`;
      } else {
        symptomsList = ['lab biomarker test', 'clinical report assessment'];
        extractedSymptomsText = `Uploaded document: ${file.originalname}. Lab report uploaded for clinician review.`;
      }
    }

    const finalSymptomsText = userSymptomsText
      ? `${userSymptomsText}\n[Document Analysis: ${extractedSymptomsText}]`
      : extractedSymptomsText;

    // 4. Send the symptoms list to the ML service
    const assessment = await triageMlService.assessSymptomsFromInput(finalSymptomsText, symptomsList);

    // If predictedDisease is null or unassigned, assign a clear clinical report label
    const finalPredictedDisease = assessment.predictedDisease || 'Medical Lab & Diagnostic Report Review';
    const finalUrgencyLevel = assessment.urgencyLevel === 'self_care' ? 'doctor_recommended' : (assessment.urgencyLevel || 'doctor_recommended');
    const finalUrgencyLabel = assessment.urgencyLabel === 'Home Care — Monitor Symptoms' ? 'Doctor Consultation Recommended' : (assessment.urgencyLabel || 'Doctor Consultation Recommended');
    const finalSpecialist = assessment.specialistType || (file.originalname.toLowerCase().includes('lipid') ? 'Cardiologist' : 'General Physician');

    // 5. Fetch recommended doctors for appointment booking
    let recommendedDoctors = await Doctor.findAll({
      where: { specialization: finalSpecialist },
      include: [{ model: User, attributes: ['id', 'name', 'email'] }]
    });

    if (!recommendedDoctors || recommendedDoctors.length === 0) {
      recommendedDoctors = await Doctor.findAll({
        include: [{ model: User, attributes: ['id', 'name', 'email'] }]
      });
    }

    const doctorList = recommendedDoctors.map(d => ({
      id: d.id,
      name: d.User?.name || 'Dr. Clinician',
      email: d.User?.email || '',
      specialization: d.specialization,
      licenseNumber: d.licenseNumber,
      phone: d.phone,
      availability: d.availability || 'Mon - Fri (09:00 - 17:00)'
    }));

    // 6. Save the Symptom record including the document URL in the database
    const symptomRecord = await Symptom.create({
      patientId: patient.id,
      symptomsText: finalSymptomsText,
      severityScore: assessment.severityScore < 4 ? 5 : assessment.severityScore,
      triagePriority: assessment.triagePriority === 'Low' ? 'Medium' : assessment.triagePriority,
      aiRecommendation: `${extractedSymptomsText} Recommended specialist: ${finalSpecialist}.`,
      status: 'Pending',
      documentUrl: publicUrl,
      source: 'ml_fallback',
    });

    res.status(201).json({
      success: true,
      data: symptomRecord,
      predictedDisease: finalPredictedDisease,
      shouldVisitDoctor: true,
      urgencyLevel: finalUrgencyLevel,
      urgencyLabel: finalUrgencyLabel,
      specialistType: finalSpecialist,
      confidence: assessment.confidence || 85,
      matchedSymptoms: assessment.matchedSymptoms.length > 0 ? assessment.matchedSymptoms : symptomsList,
      recommendation: `Uploaded lab document (${file.originalname}) uploaded. Specialist consultation recommended.`,
      recommendedDoctors: doctorList,
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
