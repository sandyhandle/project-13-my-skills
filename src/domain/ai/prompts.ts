import type { AiScore, Milestone, PracticeSessionEvent, Skill, SkillEvent } from '../types'
import type { SkillTemplate } from '../templates'

export function buildSessionScoringPrompt(options: {
  skill: Skill
  template: SkillTemplate
  currentLevel: number
  nextMilestone?: Milestone
  recentSessions: PracticeSessionEvent[]
  session: Omit<PracticeSessionEvent, 'id' | 'createdAt'>
}): { system: string; user: string } {
  const history = options.recentSessions.slice(-10).map((session) => ({
    date: session.date,
    minutes: session.minutes,
    notes: session.notes.slice(0, 300),
    points: session.pointsOverride ?? session.ai?.points ?? null,
  }))

  return {
    system: `Act as a strict, consistent skills coach evaluating one practice session.
Use the provided rubric and current level/milestone context. Score points from 0 to 100, where 50 is a solid, typical session. Avoid score inflation; penalize aimless repetition of mastered material; reward deliberate practice, stretch difficulty, feedback loops, novelty, and performance.
Use recent sessions to stay consistent. If performed is true, provide performanceImpact; otherwise it must be null.
Return ONLY valid JSON matching this shape, with no markdown or extra text:
{"points":0,"difficulty":0,"novelty":0,"focus":0,"performanceImpact":null,"summary":"","strengths":[],"improvements":[],"nextSessionSuggestion":"","milestoneEvidence":null}`,
    user: JSON.stringify({
      skill: options.skill.name,
      rubric: options.template.aiRubric,
      currentLevelPercent: Math.round(options.currentLevel * 1000) / 10,
      nextMilestone: options.nextMilestone ?? null,
      recentSessions: history,
      session: {
        date: options.session.date,
        minutes: options.session.minutes,
        notes: options.session.notes,
        templateFields: options.session.templateFields,
        performance: options.session.performance,
        selfRating: options.session.selfRating ?? null,
      },
    }),
  }
}

export function buildMonthlyReviewPrompt(options: {
  skill: Skill
  currentLevel: number
  milestones: Milestone[]
  sessions: PracticeSessionEvent[]
}): { system: string; user: string } {
  return {
    system: 'You are a calibrated skills coach. Suggest a plausible current capability level based only on milestones and recent session evidence. Never claim certainty. Return only JSON: {"suggestedLevel":0.0,"confidence":0.0,"reasoning":""}. suggestedLevel and confidence are fractions from 0 to 1.',
    user: JSON.stringify({
      skill: options.skill.name,
      currentLevel: options.currentLevel,
      milestones: options.milestones,
      recentSessions: options.sessions.map((session) => ({
        date: session.date,
        minutes: session.minutes,
        notes: session.notes,
        points: session.pointsOverride ?? session.ai?.points ?? null,
      })),
    }),
  }
}

export function buildMilestoneDraftPrompt(skillName: string, templateRubric: string): { system: string; user: string } {
  return {
    system: 'Draft 6 to 9 observable personal skill milestones at percentage levels from 0, 5, 10, 20, 30, 50, 70, 90, 100. Keep descriptions concise and progressively more capable. Return only JSON: {"milestones":[{"percent":0,"description":""}]}',
    user: JSON.stringify({ skill: skillName, rubric: templateRubric }),
  }
}

export function recentPracticeEvents(events: SkillEvent[], skillId: string): PracticeSessionEvent[] {
  return events
    .filter((event): event is PracticeSessionEvent => event.skillId === skillId && event.type === 'practice_session')
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .slice(-10)
}

export type AiScoreShape = Omit<AiScore, 'model' | 'scoredAt'>
