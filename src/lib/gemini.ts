import 'server-only'
import { GoogleGenAI } from '@google/genai'

let instance: GoogleGenAI | null = null

export function genaiClient(): GoogleGenAI {
  if (instance) return instance
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  instance = new GoogleGenAI({ apiKey })
  return instance
}
