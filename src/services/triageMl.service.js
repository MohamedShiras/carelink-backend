/**
 * Mock Machine Learning Service for Symptom Entry & AI Triage.
 * This simulates how the trained ML model will evaluate symptom severity and triage.
 */
class TriageMlService {
  /**
   * Assesses symptom severity and priority based on text description.
   * @param {string} symptomsText 
   * @returns {Promise<{ severityScore: number, triagePriority: 'Low'|'Medium'|'High'|'Emergency', recommendation: string }>}
   */
  async assessSymptoms(symptomsText) {
    // Simulating ML model processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const text = symptomsText.toLowerCase();

    // Triage rules mapping keywords to simulated model outputs
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
      };
    }

    // Default/Low priority
    return {
      severityScore: 2,
      triagePriority: 'Low',
      recommendation: 'LOW SEVERITY: Symptoms appear mild. Rest, stay hydrated, and consult a doctor if condition persists or worsens.',
    };
  }
}

export default new TriageMlService();
