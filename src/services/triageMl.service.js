import http from 'http';
import https from 'https';

/**
 * Symptom triage service.
 * Calls the Python ML service for disease prediction and triage,
 * with rule-based fallback for severity/priority.
 */
class TriageMlService {
  get mlServiceUrl() {
    return process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
  }

  normalizeSymptoms(symptoms) {
    if (Array.isArray(symptoms)) {
      return symptoms
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    if (typeof symptoms === 'string') {
      return symptoms
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  buildSymptomText(symptoms) {
    return this.normalizeSymptoms(symptoms).join(' ').toLowerCase();
  }

  async postJson(urlString, body) {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;

    return await new Promise((resolve, reject) => {
      const request = transport.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(body)),
          },
          timeout: 8000,
        },
        (response) => {
          let responseBody = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            try {
              resolve({
                statusCode: response.statusCode || 0,
                body: responseBody ? JSON.parse(responseBody) : null,
              });
            } catch (error) {
              reject(error);
            }
          });
        }
      );

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy(new Error('ML service request timed out'));
      });

      request.write(JSON.stringify(body));
      request.end();
    });
  }

  /**
   * Calls the Python ML service and returns the full enhanced prediction response.
   * Returns null if the service is unavailable.
   *
   * @param {string[]|string} symptoms
   * @returns {Promise<object|null>} Full ML prediction with triage data, or null
   */
  async predictDisease(symptoms) {
    const normalizedSymptoms = this.normalizeSymptoms(symptoms);

    if (normalizedSymptoms.length === 0) {
      return null;
    }

    try {
      const response = await this.postJson(`${this.mlServiceUrl}/predict`, {
        symptoms: normalizedSymptoms,
      });

      if (response.statusCode >= 200 && response.statusCode < 300 && response.body) {
        // Return the full enhanced response from the ML service
        return {
          predictedDisease: response.body.predicted_disease || null,
          confidence: response.body.confidence || 0,
          shouldVisitDoctor: response.body.should_visit_doctor ?? true,
          urgencyLevel: response.body.urgency_level || 'doctor_recommended',
          urgencyLabel: response.body.urgency_label || 'Schedule a Doctor Visit',
          recommendation: response.body.recommendation || '',
          specialistType: response.body.specialist_type || 'General Physician',
          matchedSymptoms: response.body.matched_symptoms || [],
        };
      }
    } catch (error) {
      console.warn('ML service unavailable, falling back to rule-based triage:', error.message);
      return null;
    }

    return null;
  }

  /**
   * Assesses symptom severity and priority based on text description.
   * @param {string} symptomsText
   * @returns {Promise<object>}
   */
  async assessSymptoms(symptomsText) {
    return await this.assessSymptomsFromInput(symptomsText, this.normalizeSymptoms(symptomsText));
  }

  async assessSymptomsFromInput(symptomsInput, symptomsList = []) {
    // Simulating ML model processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const text = this.buildSymptomText(symptomsInput);
    const mlResult = await this.predictDisease(symptomsList.length > 0 ? symptomsList : symptomsInput);

    // If the ML service returned a full enhanced response, use its triage data
    if (mlResult) {
      // Map ML urgency levels to the existing triagePriority enum
      const urgencyToPriority = {
        emergency: 'Emergency',
        doctor_required: 'High',
        doctor_recommended: 'Medium',
        self_care: 'Low',
      };

      const urgencyToSeverity = {
        emergency: 9,
        doctor_required: 7,
        doctor_recommended: 4,
        self_care: 2,
      };

      return {
        severityScore: urgencyToSeverity[mlResult.urgencyLevel] || 4,
        triagePriority: urgencyToPriority[mlResult.urgencyLevel] || 'Medium',
        recommendation: mlResult.recommendation,
        predictedDisease: mlResult.predictedDisease,
        // Enhanced triage fields
        shouldVisitDoctor: mlResult.shouldVisitDoctor,
        urgencyLevel: mlResult.urgencyLevel,
        urgencyLabel: mlResult.urgencyLabel,
        specialistType: mlResult.specialistType,
        confidence: mlResult.confidence,
        matchedSymptoms: mlResult.matchedSymptoms,
      };
    }

    // ── Fallback: rule-based triage when ML service is unavailable ──

    if (
      text.includes('chest pain') ||
      text.includes('heart attack') ||
      text.includes('difficulty breathing') ||
      text.includes('shortness of breath') ||
      text.includes('stroke') ||
      text.includes('unconscious')
    ) {
      return {
        severityScore: 9,
        triagePriority: 'Emergency',
        recommendation: 'EMERGENCY: Please proceed to the nearest emergency department immediately or call an ambulance. Critical symptoms detected.',
        predictedDisease: null,
        shouldVisitDoctor: true,
        urgencyLevel: 'emergency',
        urgencyLabel: 'Emergency — Seek Immediate Care',
        specialistType: 'Emergency Medicine',
        confidence: 0,
        matchedSymptoms: [],
      };
    }

    if (
      text.includes('severe pain') ||
      text.includes('high fever') ||
      text.includes('bleeding') ||
      text.includes('fracture') ||
      text.includes('vomiting') && text.includes('blood')
    ) {
      return {
        severityScore: 7,
        triagePriority: 'High',
        recommendation: 'HIGH SEVERITY: Recommend visiting an urgent care clinic or consulting with a specialist within 24 hours.',
        predictedDisease: null,
        shouldVisitDoctor: true,
        urgencyLevel: 'doctor_required',
        urgencyLabel: 'Urgent — Visit a Doctor Within 24 Hours',
        specialistType: 'General Physician',
        confidence: 0,
        matchedSymptoms: [],
      };
    }

    if (
      text.includes('fever') ||
      text.includes('cough') ||
      text.includes('headache') ||
      text.includes('stomach ache') ||
      text.includes('diarrhea') ||
      text.includes('nausea')
    ) {
      return {
        severityScore: 4,
        triagePriority: 'Medium',
        recommendation: 'MODERATE SEVERITY: Set up an appointment with a General Practitioner. Maintain hydration and monitor symptoms.',
        predictedDisease: null,
        shouldVisitDoctor: true,
        urgencyLevel: 'doctor_recommended',
        urgencyLabel: 'Schedule a Doctor Visit',
        specialistType: 'General Physician',
        confidence: 0,
        matchedSymptoms: [],
      };
    }

    // Default/Low priority
    return {
      severityScore: 2,
      triagePriority: 'Low',
      recommendation: 'LOW SEVERITY: Symptoms appear mild. Rest, stay hydrated, and consult a doctor if condition persists or worsens.',
      predictedDisease: null,
      shouldVisitDoctor: false,
      urgencyLevel: 'self_care',
      urgencyLabel: 'Home Care — Monitor Symptoms',
      specialistType: 'General Physician',
      confidence: 0,
      matchedSymptoms: [],
    };
  }
}

export default new TriageMlService();
