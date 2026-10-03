
import {genkit, z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: 'AQ.Ab8RN6KntKYXzWAvMorKVpxaWJH8wPmB2PXw9RnfVL7Bgw-4Hg' 
    })
  ],
  model: googleAI.model('gemini-1.5-flash'),
});

export { z };
