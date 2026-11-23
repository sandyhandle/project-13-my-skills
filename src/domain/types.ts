export type ISODate = string
export type ISODateTime = string
export type SkillStatus = 'active' | 'maintenance' | 'dormant'

export interface Milestone {
  id: string
  percent: number
  description: string
}

export interface SkillConfig {
  baseGrowth: number
  graceDays: number
  halfLifeDays: number
  recoveryBoost: number
  referenceMinutes: number
  maxUnitsPerDay: number
  maintenanceDecayMultiplier: number
  dormantDecayMultiplier: number
  retentionFloorRatio: number
}

export interface Skill {
  id: string
  name: string
  emoji?: string
  category?: string
  templateId: string
  milestones: Milestone[]
  createdOn: ISODate
  archived: boolean
  demo?: boolean
}

interface BaseEvent {
  id: string
  skillId: string
  date: ISODate
  createdAt: ISODateTime
}

export interface SkillCreatedEvent extends BaseEvent {
  type: 'skill_created'
  initialLevel: number
  config: SkillConfig
  status: SkillStatus
}

export interface PracticeSessionEvent extends BaseEvent {
  type: 'practice_session'
  minutes: number
  notes: string
  performance: {
    performed: boolean
    typeId?: string
    audienceSize?: number
    link?: string
    notes?: string
  }
  templateFields: Record<string, string | number | boolean | string[]>
  selfRating?: 1 | 2 | 3 | 4 | 5
  ai?: AiScore
  pointsOverride?: number
}

export interface ManualAdjustmentEvent extends BaseEvent {
  type: 'manual_adjustment'
  newLevel: number
  reason: string
  lowerPeakToo: boolean
}

export interface ConfigChangedEvent extends BaseEvent {
  type: 'config_changed'
  config: SkillConfig
}

export interface StatusChangedEvent extends BaseEvent {
  type: 'status_changed'
  status: SkillStatus
  reason?: string
}

export interface SeasonPlan {
  goal: string
  targetDate?: ISODate
  targetLevel?: number
  sessionsPerWeek: number
  minutesPerSession?: number
  endCondition?: string
  revisitDate?: ISODate
}

export interface SeasonStartedEvent extends BaseEvent {
  type: 'season_started'
  plan: SeasonPlan
}

export interface SeasonEndedEvent extends BaseEvent {
  type: 'season_ended'
  outcome: string
  nextStatus: SkillStatus
  revisitDate?: ISODate
}

export type SkillEvent =
  | SkillCreatedEvent
  | PracticeSessionEvent
  | ManualAdjustmentEvent
  | ConfigChangedEvent
  | StatusChangedEvent
  | SeasonStartedEvent
  | SeasonEndedEvent

export interface AiScore {
  points: number
  difficulty: number
  novelty: number
  focus: number
  performanceImpact: number | null
  summary: string
  strengths: string[]
  improvements: string[]
  nextSessionSuggestion: string
  milestoneEvidence: string | null
  model: string
  scoredAt: ISODateTime
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark'
  anthropicApiKey?: string
  aiModel: string
  aiEnabled: boolean
  lastExportAt?: ISODateTime
  lastCheckinAt?: ISODateTime
  changeThresholdPp: number
}

export interface AppData {
  schemaVersion: number
  settings: AppSettings
  skills: Skill[]
  events: SkillEvent[]
}

export interface DailyPoint {
  date: ISODate
  level: number
  peak: number
  status: SkillStatus
  inactiveDays: number
  decaying: boolean
  recovering: boolean
  sessionCount: number
  minutes: number
  delta: number
}
