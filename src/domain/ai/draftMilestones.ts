import type { Milestone } from '../types'
import { sendAnthropicMessage } from './client'
import { buildMilestoneDraftPrompt } from './prompts'
import { milestoneDraftResponseSchema, parseJsonResponse } from './schema'

export async function draftMilestones(options: {
  apiKey: string
  model: string
  skillName: string
  rubric: string
  fetcher?: typeof fetch
}): Promise<Milestone[]> {
  const prompt = buildMilestoneDraftPrompt(options.skillName, options.rubric)
  const text = await sendAnthropicMessage({
    apiKey: options.apiKey,
    model: options.model,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    fetcher: options.fetcher,
  })
  const parsed = parseJsonResponse(text, milestoneDraftResponseSchema)
  return parsed.milestones
    .map((item, index) => ({ id: `ai-milestone-${index}-${item.percent}`, ...item }))
    .sort((a, b) => a.percent - b.percent)
}
