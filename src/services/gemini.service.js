import dotenv from 'dotenv';

dotenv.config();

class GeminiService {
  /**
   * Analyzes an uploaded document (image or PDF) using Gemini 1.5 Flash.
   * Extracts symptoms and provides a short summary.
   * 
   * @param {Buffer} buffer - The file buffer
   * @param {string} mimeType - The mime type of the file (e.g. application/pdf, image/png)
   * @returns {Promise<{symptoms: string[], summary: string} | null>} Extracted data or null if fails/not configured
   */
  async analyzeDocument(buffer, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('GEMINI_API_KEY is not defined in environment variables. Skipping real AI document analysis.');
      return null;
    }

    try {
      console.log(`Sending document to Gemini API for parsing (mimeType: ${mimeType})...`);
      const base64Data = buffer.toString('base64');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Analyze the uploaded medical document (image or PDF). Extract all medical symptoms mentioned. ' +
                        'Return a JSON object with two fields: ' +
                        '"symptoms" (a flat array of matching symptom strings, e.g. ["fever", "cough", "shortness of breath"]) and ' +
                        '"summary" (a string summarizing the patient\'s condition as detailed in the document). ' +
                        'Ensure that your response contains ONLY valid JSON and no markdown formatting wrappers (like ```json).',
                },
                {
                  inlineData: {
                    mimeType: mimeType,
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      const parsed = JSON.parse(text.trim());
      return {
        symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
        summary: parsed.summary || '',
      };
    } catch (error) {
      console.error('Gemini Service Error:', error.message);
      return null;
    }
  }
}

export default new GeminiService();
