import dotenv from 'dotenv';

dotenv.config();

class GroqService {
  /**
   * Request JSON analysis from Groq's ultra-fast Llama 3.2 Vision engine (<500ms latency).
   * @param {string} prompt
   * @param {Buffer} buffer
   * @param {string} mimeType
   * @returns {Promise<object|null>}
   */
  async requestJsonAnalysis(prompt, buffer, mimeType) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return null;
    }

    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const modelsToTry = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUrl
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 1024,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            return JSON.parse(text.trim());
          }
        } else {
          const errorText = await response.text();
          console.warn(`Groq Vision API error (${modelName}) ${response.status}:`, errorText);
          lastError = new Error(`Groq API ${modelName} error: ${response.status}`);
        }
      } catch (err) {
        console.warn(`Groq model ${modelName} call failed:`, err.message);
        lastError = err;
      }
    }

    if (lastError) {
      console.error('Groq Service Error:', lastError.message);
    }
    return null;
  }

  /**
   * Predicts disease, urgency, and specialist from uploaded medical report using Groq Llama 3.2 Vision.
   */
  async predictFromDocument(buffer, mimeType, symptomsText = '') {
    try {
      const prompt = `You are an expert AI clinical diagnostic assistant.
Examine the uploaded image or document carefully.
Determine whether the image/document is a valid medical report, lab result, clinical document, radiology scan, ECG, or medical symptom photo.

IF THE IMAGE IS NOT A MEDICAL DOCUMENT / NOT A MEDICAL REPORT / NOT A SYMPTOM PHOTO (e.g. a personal selfie, portrait, landscape photo, object, meme, or non-medical picture):
Return ONLY valid JSON with:
- "isMedicalDocument": false
- "predictedDisease": "Non-Medical Image Uploaded"
- "confidence": 0
- "shouldVisitDoctor": false
- "urgencyLevel": "self_care"
- "urgencyLabel": "No Medical Findings Detected"
- "specialistType": "General Physician"
- "recommendation": "The uploaded image does not contain a readable medical lab report or clinical scan. Please upload a valid medical document or lab report image."
- "matchedSymptoms": []
- "summary": "The uploaded image is a non-medical picture or personal photo."

IF THE IMAGE IS A VALID MEDICAL REPORT / LAB TEST / SCANS / CLINICAL DOCUMENT:
- "isMedicalDocument": true
- Read all test names, numerical values, units, and reference ranges (even if rotated or sideways).
- Identify abnormal biomarkers (e.g. elevated cholesterol/triglycerides = Hyperlipidemia; high glucose/HbA1c = Diabetes; abnormal CBC = Anemia; abnormal ECG/X-ray = Cardiac/Pulmonary).
- Determine exact specialistType: "Cardiologist", "Endocrinologist", "Pulmonologist", "Nephrologist", "Dermatologist", "Orthopedist", "Ophthalmologist", "General Physician".
- Return ONLY valid JSON with:
  - "isMedicalDocument": true
  - "predictedDisease": concise condition name (e.g. "Hyperlipidemia (Elevated Lipid Profile)")
  - "confidence": number (e.g. 85)
  - "shouldVisitDoctor": true
  - "urgencyLevel": "doctor_recommended" or "doctor_required" or "emergency"
  - "urgencyLabel": short title (e.g. "Cardiologist Consultation Recommended")
  - "specialistType": specific specialist name
  - "recommendation": clear explanation of findings and advice
  - "matchedSymptoms": array of abnormal lab values found
  - "summary": concise report summary`;

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
        summary: parsed.summary || (isMedical ? 'Uploaded medical document analyzed by Groq AI.' : 'Non-medical image uploaded.'),
        symptomsText: symptomsText || '',
        provider: 'groq'
      };
    } catch (error) {
      console.error('Groq report prediction error:', error.message);
      return null;
    }
  }
}

export default new GroqService();
