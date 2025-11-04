import { GoogleGenerativeAI } from '@google/generative-ai'
import { BusinessModelCanvas } from './database.types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Simple exponential backoff with jitter
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0
  let lastErr: any
  while (attempt <= retries) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const isOverloaded =
        (err?.status === 503) ||
        /503|overloaded|Service Unavailable/i.test(err?.message || '')
      if (!isOverloaded || attempt === retries) break
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 300, 5000)
      await new Promise((res) => setTimeout(res, delay))
      attempt++
    }
  }
  throw lastErr
}

function parseCanvas(text: string): BusinessModelCanvas {
  let cleanedText = text.trim()
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/```json\n?/, '').replace(/\n?```$/, '')
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/```\n?/, '').replace(/\n?```$/, '')
  }
  const canvas: BusinessModelCanvas = JSON.parse(cleanedText)
  const requiredFields = [
    'key_partners',
    'key_activities',
    'value_propositions',
    'customer_relationships',
    'customer_segments',
    'key_resources',
    'channels',
    'cost_structure',
    'revenue_streams',
  ]
  for (const field of requiredFields) {
    if (!canvas[field as keyof BusinessModelCanvas]) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  return canvas
}

function fallbackCanvas(businessIdea: string, industry: string): BusinessModelCanvas {
  const idea = businessIdea?.trim() || 'Your product or service'
  const sector = industry?.trim() || 'General'
  return {
    key_partners: [
      `Suppliers and vendors in ${sector}`,
      'Technology providers and integration partners',
      'Marketing affiliates and community leaders',
    ],
    key_activities: [
      `Product development and iteration for ${idea}`,
      'Customer acquisition and onboarding',
      'Content/education and community engagement',
    ],
    value_propositions: [
      `Easy-to-use, time‑saving solution for ${sector} needs`,
      'Measurable outcomes and transparent pricing',
      'Delightful UX with responsive support',
    ],
    customer_relationships: [
      'Self‑serve onboarding with guided flows',
      'Proactive support via tutorials and messaging',
      'Feedback loops and roadmap transparency',
    ],
    customer_segments: [
      `Early adopters in ${sector}`,
      'SMBs and individual professionals',
      'Enterprise teams seeking pilot programs',
    ],
    key_resources: [
      'Core application platform and cloud infrastructure',
      'Domain expertise and content assets',
      'Customer data and analytics',
    ],
    channels: [
      'Website, SEO, and content marketing',
      'Social media and partnerships',
      'App stores and integrations',
    ],
    cost_structure: [
      'Cloud hosting and third‑party services',
      'Engineering, design, and support',
      'Marketing and sales operations',
    ],
    revenue_streams: [
      'Subscription tiers (free, pro, enterprise)',
      'One‑time purchases or add‑ons',
      'Partnerships and affiliate revenue',
    ],
  }
}

export async function generateBusinessCanvas(
  businessIdea: string,
  industry: string
): Promise<BusinessModelCanvas> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a business strategy expert.
Given this business idea/description, generate a structured Business Model Canvas as valid JSON with the following fields:
key_partners, key_activities, value_propositions, customer_relationships, customer_segments, key_resources, channels, cost_structure, revenue_streams.

Business Idea: ${businessIdea}
Industry: ${industry}

Use clear, professional language for each section.
Each field should be an array of 3-5 concise bullet points.
Return ONLY valid JSON data with no markdown, no code blocks, and no extra text.`

  try {
    const result = await withRetry(() => model.generateContent(prompt), 3)
    const response = await result.response
    const text = response.text()
    return parseCanvas(text)
  } catch (error: any) {
    console.error('Gemini API Error:', error)
    // Fallback to a deterministic canvas so the app remains usable
    return fallbackCanvas(businessIdea, industry)
  }
}
