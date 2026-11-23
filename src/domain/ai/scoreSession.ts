import type { AiScore, PracticeSessionEvent, Skill, Milestone } from '../types'
import type { SkillTemplate } from '../templates'
import { fallbackScore } from './fallbackScore'
import { sendAnthropicMessage, AnthropicApiError } from './client'
import { buildSessionScoringPrompt } from './prompts'
import { aiScoreResponseSchema, parseJsonResponse } from './schema'

export interface ScoreSessionResult {
  score: AiScore
  usedFallback: boolean
  error?: string
}

export async function scoreSession(options: {
  apiKey?: string
  model: string
  skill: Skill
  template: SkillTemplate
  currentLevel: number
  nextMilestone?: Milestone
  recentSessions: PracticeSessionEvent[]
  session: Omit<PracticeSessionEvent, 'id' | 'createdAt'>
  fetcher?: typeof fetch
}): Promise<ScoreSessionResult> {
  const fallback = () => ({
    score: {
      points: fallbackScore(options.session),
      difficulty: 50,
      novelty: 50,
      focus: (options.session.selfRating ?? 3) * 20,
      performanceImpact: options.session.performance.performed ? 50 : null,
      summary: 'Estimated using the session notes, self-rating, and performance input.',
      strengths: [],
      improvements: [],
      nextSessionSuggestion: 'Choose one specific challenge to focus on next time.',
      milestoneEvidence: null,
      model: 'fallback',
      scoredAt: new Date().toISOString(),
    } satisfies AiScore,
    usedFallback: true,
  })

  if (!options.apiKey) return { ...fallback(), error: 'AI is not configured; used the estimated score.' }

  const prompt = buildSessionScoringPrompt(options)
  let lastError = 'AI scoring response was invalid.'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = await sendAnthropicMessage({
        apiKey: options.apiKey,
        model: options.model,
        system: attempt === 0 ? prompt.system : `${prompt.system}\nReturn only JSON.`,
        messages: [{ role: 'user', content: prompt.user }],
        fetcher: options.fetcher,
      })
      const parsed = parseJsonResponse(text, aiScoreResponseSchema)
      return {
        score: { ...parsed, model: options.model, scoredAt: new Date().toISOString() },
        usedFallback: false,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'AI scoring failed.'
      if (error instanceof AnthropicApiError && error.status !== undefined) break
    }
  }

  return { ...fallback(), error: lastError }
}
