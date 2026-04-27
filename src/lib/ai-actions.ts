'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function getAIResponse(prompt: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  try {
    // Using gemini-2.5-flash (latest as of 2026)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Error calling Gemini API:', error.message || error);
    if (error.response) {
      console.error('Gemini API Response Error:', error.response.data || error.response);
    }
    throw new Error(`AI Analysis failed: ${error.message || 'Unknown error'}`);
  }
}
