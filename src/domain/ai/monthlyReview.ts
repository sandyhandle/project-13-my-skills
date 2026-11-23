import type { Milestone, PracticeSessionEvent, Skill } from '../types'
import { sendAnthropicMessage } from './client'
import { buildMonthlyReviewPrompt } from './prompts'
import { monthlyReviewResponseSchema, parseJsonResponse } from './schema'

export async function monthlyReview(options: {
  apiKey: string
  model: string
  skill: Skill
  currentLevel: number
  milestones: Milestone[]
  sessions: PracticeSessionEvent[]
  fetcher?: typeof fetch
}): Promise<{ suggestedLevel: number; confidence: number; reasoning: string }> {
  const prompt = buildMonthlyReviewPrompt(options)
  const text = await sendAnthropicMessage({
    apiKey: options.apiKey,
    model: options.model,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    fetcher: options.fetcher,
  })
  return parseJsonResponse(text, monthlyReviewResponseSchema)
}
