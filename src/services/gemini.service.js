import dotenv from 'dotenv';

dotenv.config();

class GeminiService {
  async requestJsonAnalysis(prompt, buffer, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('GEMINI_API_KEY is not defined in environment variables. Skipping Gemini analysis.');
      return null;
    }

    const base64Data = buffer.toString('base64');
    const modelsToTry = ['gemini-1.5-flash'];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return JSON.parse(text.trim());
          }
        } else {
          const errorText = await response.text();
          console.warn(`Gemini API model ${modelName} returned status ${response.status}: ${errorText}`);
          lastError = new Error(`Gemini API ${modelName} error: ${response.status}`);
        }
      } catch (err) {
        console.warn(`Gemini model ${modelName} call failed:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini API models failed');
  }

  /**
   * Analyzes an uploaded document (image or PDF) using Gemini.
   * Extracts symptoms and provides a short summary.
   */
  async analyzeDocument(buffer, mimeType) {
    try {
      console.log(`Sending document to Gemini API for parsing (mimeType: ${mimeType})...`);
      const parsed = await this.requestJsonAnalysis(
        'Analyze the uploaded document or image. Determine if it is a medical document/scan. If medical, extract all symptoms or lab abnormalities mentioned. Return ONLY valid JSON with fields: "isMedicalDocument" (boolean), "symptoms" (flat array of strings), and "summary" (concise summary).',
        buffer,
        mimeType
      );
      return {
        isMedicalDocument: parsed.isMedicalDocument !== false,
        symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
        summary: parsed.summary || '',
      };
    } catch (error) {
      console.error('Gemini Service Error:', error.message);
      return null;
    }
  }

  /**
   * Uses Gemini to predict disease / urgency directly from an uploaded medical report.
   * Returns structured triage data, or null if Gemini is unavailable.
   */
  async predictFromDocument(buffer, mimeType, symptomsText = '') {
    try {
      const prompt = `You are CareLink AI powered by Google Gemini 1.5 Flash, an expert medical diagnostic and clinical report analysis assistant.

TASK:
Examine the uploaded document or image carefully (note: images may be rotated 90°, 180°, or sideways, so read orientation carefully).

1. IF THE UPLOADED FILE IS A MEDICAL LAB REPORT, TEST STRIP, BLOOD WORK, DIAGNOSTIC SCAN, PRESCRIPTION, ECG, RADIOLOGY REPORT, OR CLINICAL DOCUMENT:
- Read all visible test names, numerical values, units (e.g. micro IU/ml, mg/dL, mmol/L), reference ranges, and notes.
- Provide a clear, thorough summary of the report results in human-understandable terms.
- Highlight any abnormal values vs normal reference ranges.
- Determine the appropriate specialist: e.g. "Endocrinologist" (thyroid, hormone, diabetes), "Cardiologist" (lipid, ECG, heart), "Hematologist" (CBC, blood), "Nephrologist" (kidney, creatinine), "Pulmonologist" (chest, lungs), "General Physician".
- Return ONLY valid JSON with:
  - "isMedicalDocument": true
  - "predictedDisease": concise title e.g. "Lab Analysis: Endocrine / Hormone Test (Result: 2.983 micro IU/ml)"
  - "confidence": integer 1-100 (e.g. 92)
  - "shouldVisitDoctor": true
  - "urgencyLevel": "doctor_recommended" or "doctor_required" or "emergency" or "self_care"
  - "urgencyLabel": title e.g. "Endocrinologist Consultation Recommended"
  - "specialistType": specialist name e.g. "Endocrinologist" or "General Physician"
  - "summary": detailed clinical summary explaining the test name, value (e.g. 2.983 micro IU/ml), reference range (e.g. 0.7 - 27.3 micro IU/ml), and overall health impression
  - "recommendation": clear actionable medical advice and next steps for the patient
  - "matchedSymptoms": array of strings listing key lab parameters or symptoms found e.g. ["Hormone Test Result: 2.983 micro IU/ml", "Reference Range: 0.7 - 27.3 micro IU/ml"]

2. IF THE IMAGE IS NOT A MEDICAL DOCUMENT (e.g. selfie, landscape, object):
- Return ONLY valid JSON with:
  - "isMedicalDocument": false
  - "predictedDisease": "Non-Medical Image Uploaded"
  - "confidence": 0
  - "shouldVisitDoctor": false
  - "urgencyLevel": "self_care"
  - "urgencyLabel": "No Medical Document Detected"
  - "specialistType": "General Physician"
  - "summary": "The uploaded image does not appear to be a medical lab report or diagnostic scan."
  - "recommendation": "Please upload a clear image of a medical lab report, blood test result, or diagnostic scan for AI summary analysis."
  - "matchedSymptoms": []`;

      const parsed = await this.requestJsonAnalysis(prompt, buffer, mimeType);

      if (!parsed) return null;

      const isMedical = parsed.isMedicalDocument !== false && parsed.predictedDisease !== 'Non-Medical Image Uploaded';
      const confidence = Number(parsed.confidence);

      return {
        isMedicalDocument: isMedical,
        predictedDisease: parsed.predictedDisease || (isMedical ? 'Medical Lab Report Analysis' : 'Non-Medical Image Uploaded'),
        confidence: Number.isFinite(confidence) ? confidence : (isMedical ? 85 : 0),
        shouldVisitDoctor: isMedical ? (parsed.shouldVisitDoctor !== undefined ? Boolean(parsed.shouldVisitDoctor) : true) : false,
        urgencyLevel: isMedical ? (parsed.urgencyLevel || 'doctor_recommended') : 'self_care',
        urgencyLabel: isMedical ? (parsed.urgencyLabel || `${parsed.specialistType || 'Doctor'} Consultation Recommended`) : 'No Medical Findings Detected',
        specialistType: parsed.specialistType || 'General Physician',
        recommendation: parsed.recommendation || (isMedical ? 'Consult with a specialist to review your lab report.' : 'The uploaded file does not appear to be a medical document.'),
        matchedSymptoms: Array.isArray(parsed.matchedSymptoms) ? parsed.matchedSymptoms : [],
        summary: parsed.summary || (isMedical ? 'Uploaded medical document analyzed by Gemini 1.5 Flash.' : 'Non-medical image uploaded.'),
        symptomsText: symptomsText || '',
        provider: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Gemini report prediction error:', error.message);
      return null;
    }
  }
}

export default new GeminiService();
