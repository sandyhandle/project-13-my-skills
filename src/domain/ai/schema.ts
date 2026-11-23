import { z } from 'zod'

export const aiScoreResponseSchema = z.object({
  points: z.number().min(0).max(100),
  difficulty: z.number().min(0).max(100),
  novelty: z.number().min(0).max(100),
  focus: z.number().min(0).max(100),
  performanceImpact: z.number().min(0).max(100).nullable(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  nextSessionSuggestion: z.string(),
  milestoneEvidence: z.string().nullable(),
}).strict()

export const monthlyReviewResponseSchema = z.object({
  suggestedLevel: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
}).strict()

export const milestoneDraftResponseSchema = z.object({
  milestones: z.array(z.object({
    percent: z.number().min(0).max(100),
    description: z.string(),
  }).strict()).min(6).max(9),
}).strict()

export function parseJsonResponse<T>(text: string, schema: z.ZodType<T>): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('AI response did not contain a JSON object.')
  return schema.parse(JSON.parse(text.slice(start, end + 1)) as unknown)
}
