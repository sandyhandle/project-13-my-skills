import { describe, expect, it, vi } from 'vitest'
import { sendAnthropicMessage } from '../client'
import { scoreSession } from '../scoreSession'
import { monthlyReview } from '../monthlyReview'
import { draftMilestones } from '../draftMilestones'
import { parseJsonResponse, aiScoreResponseSchema } from '../schema'
import { getTemplateById } from '../../templates'
import type { PracticeSessionEvent, Skill } from '../../types'

const skill: Skill = {
  id: 'skill-1',
  name: 'Guitar',
  templateId: 'guitar',
  milestones: [],
  createdOn: '2026-11-23',
  archived: false,
}

const session: Omit<PracticeSessionEvent, 'id' | 'createdAt'> = {
  type: 'practice_session',
  skillId: skill.id,
  date: '2026-11-23',
  minutes: 30,
  notes: 'Practiced chord changes, recorded and reviewed the difficult transition.',
  performance: { performed: false },
  templateFields: {},
  selfRating: 4,
}

const scoreResponse = {
  points: 62,
  difficulty: 60,
  novelty: 55,
  focus: 75,
  performanceImpact: null,
  summary: 'Focused practice with useful review.',
  strengths: ['Used feedback'],
  improvements: ['Slow down transitions'],
  nextSessionSuggestion: 'Repeat at a slower tempo.',
  milestoneEvidence: null,
}

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('Anthropic AI helpers', () => {
  it('sends direct-browser headers and extracts response text', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse({ content: [{ type: 'text', text: 'OK' }] }))
    const result = await sendAnthropicMessage({
      apiKey: 'test-key',
      model: 'test-model',
      system: 'Be brief',
      messages: [{ role: 'user', content: 'Test' }],
      fetcher: fetcher as typeof fetch,
    })

    expect(result).toBe('OK')
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-version': '2023-06-01',
      'x-api-key': 'test-key',
    })
  })

  it('provides a friendly authentication error', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse({ error: { message: 'invalid' } }, 401))
    await expect(sendAnthropicMessage({
      apiKey: 'bad',
      model: 'test',
      system: '',
      messages: [{ role: 'user', content: '' }],
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('Anthropic rejected the API key')
  })

  it('retries malformed JSON once and returns a validated score', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: 'not json' }] }))
      .mockResolvedValueOnce(mockResponse({ content: [{ type: 'text', text: JSON.stringify(scoreResponse) }] }))
    const result = await scoreSession({
      apiKey: 'test-key',
      model: 'test-model',
      skill,
      template: getTemplateById('guitar')!,
      currentLevel: 0.2,
      recentSessions: [],
      session,
      fetcher: fetcher as typeof fetch,
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.usedFallback).toBe(false)
    expect(result.score.points).toBe(62)
    expect(result.score.model).toBe('test-model')
  })

  it('uses the deterministic fallback if both AI responses are invalid', async () => {
    const fetcher = vi.fn().mockImplementation(async () =>
      mockResponse({ content: [{ type: 'text', text: 'invalid' }] }),
    )
    const result = await scoreSession({
      apiKey: 'test-key',
      model: 'test-model',
      skill,
      template: getTemplateById('guitar')!,
      currentLevel: 0.2,
      recentSessions: [],
      session,
      fetcher: fetcher as typeof fetch,
    })
    expect(result.usedFallback).toBe(true)
    expect(result.error).toContain('JSON')
  })

  it('parses valid JSON embedded in surrounding text and rejects invalid shapes', () => {
    expect(parseJsonResponse(`Here: ${JSON.stringify(scoreResponse)} done`, aiScoreResponseSchema).points).toBe(62)
    expect(() => parseJsonResponse('{"points": "bad"}', aiScoreResponseSchema)).toThrow()
  })

  it('validates monthly review suggestions without applying them', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockResponse({
      content: [{ type: 'text', text: JSON.stringify({ suggestedLevel: 0.3, confidence: 0.75, reasoning: 'Recent evidence supports this level.' }) }],
    }))
    const result = await monthlyReview({
      apiKey: 'test-key',
      model: 'test-model',
      skill,
      currentLevel: 0.2,
      milestones: [],
      sessions: [],
      fetcher: fetcher as typeof fetch,
    })
    expect(result.suggestedLevel).toBe(0.3)
    expect(result.confidence).toBe(0.75)
  })

  it('validates AI milestone drafts', async () => {
    const milestones = [0, 5, 10, 20, 30, 50].map((percent) => ({ percent, description: `Milestone ${percent}` }))
    const fetcher = vi.fn().mockResolvedValue(mockResponse({
      content: [{ type: 'text', text: JSON.stringify({ milestones }) }],
    }))
    const result = await draftMilestones({
      apiKey: 'test-key',
      model: 'test-model',
      skillName: 'Guitar',
      rubric: 'Deliberate practice',
      fetcher: fetcher as typeof fetch,
    })
    expect(result).toHaveLength(6)
    expect(result.map((milestone) => milestone.percent)).toEqual([0, 5, 10, 20, 30, 50])
  })
})
