import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isoDateTime = z.string()

const milestoneSchema = z.object({
  id: z.string(),
  percent: z.number().min(0).max(100),
  description: z.string(),
})

const skillConfigSchema = z.object({
  baseGrowth: z.number().min(0).max(1),
  graceDays: z.number().min(0),
  halfLifeDays: z.number().positive(),
  recoveryBoost: z.number().min(0),
  referenceMinutes: z.number().positive(),
  maxUnitsPerDay: z.number().positive(),
  maintenanceDecayMultiplier: z.number().min(0),
  dormantDecayMultiplier: z.number().min(0),
  retentionFloorRatio: z.number().min(0).max(1),
})

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().optional(),
  category: z.string().optional(),
  templateId: z.string(),
  milestones: z.array(milestoneSchema),
  createdOn: isoDate,
  archived: z.boolean(),
  demo: z.boolean().optional(),
})

const baseEventSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  date: isoDate,
  createdAt: isoDateTime,
})

const aiScoreSchema = z.object({
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
  model: z.string(),
  scoredAt: isoDateTime,
})

const templateFieldValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
])

export const skillEventSchema = z.discriminatedUnion('type', [
  baseEventSchema.extend({
    type: z.literal('skill_created'),
    initialLevel: z.number().min(0).max(1),
    config: skillConfigSchema,
    status: z.enum(['active', 'maintenance', 'dormant']),
  }),
  baseEventSchema.extend({
    type: z.literal('practice_session'),
    minutes: z.number().min(0),
    notes: z.string(),
    performance: z.object({
      performed: z.boolean(),
      typeId: z.string().optional(),
      audienceSize: z.number().min(0).optional(),
      link: z.string().optional(),
      notes: z.string().optional(),
    }),
    templateFields: z.record(z.string(), templateFieldValue),
    selfRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    ai: aiScoreSchema.optional(),
    pointsOverride: z.number().min(0).max(100).optional(),
  }),
  baseEventSchema.extend({
    type: z.literal('manual_adjustment'),
    newLevel: z.number().min(0).max(1),
    reason: z.string(),
    lowerPeakToo: z.boolean(),
  }),
  baseEventSchema.extend({
    type: z.literal('config_changed'),
    config: skillConfigSchema,
  }),
  baseEventSchema.extend({
    type: z.literal('status_changed'),
    status: z.enum(['active', 'maintenance', 'dormant']),
    reason: z.string().optional(),
  }),
  baseEventSchema.extend({
    type: z.literal('season_started'),
    plan: z.object({
      goal: z.string(),
      targetDate: isoDate.optional(),
      targetLevel: z.number().min(0).max(1).optional(),
      sessionsPerWeek: z.number().min(0),
      minutesPerSession: z.number().positive().optional(),
      endCondition: z.string().optional(),
      revisitDate: isoDate.optional(),
    }),
  }),
  baseEventSchema.extend({
    type: z.literal('season_ended'),
    outcome: z.string(),
    nextStatus: z.enum(['active', 'maintenance', 'dormant']),
    revisitDate: isoDate.optional(),
  }),
])

export const appSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  anthropicApiKey: z.string().optional(),
  aiModel: z.string(),
  aiEnabled: z.boolean(),
  lastExportAt: isoDateTime.optional(),
  lastCheckinAt: isoDateTime.optional(),
  changeThresholdPp: z.number().min(0),
})

export const appDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  settings: appSettingsSchema,
  skills: z.array(skillSchema),
  events: z.array(skillEventSchema),
})
