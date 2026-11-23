import type { AppData, AppSettings, SkillConfig } from './types'

export const defaultSkillConfig: SkillConfig = {
  baseGrowth: 0.002,
  graceDays: 7,
  halfLifeDays: 180,
  recoveryBoost: 2,
  referenceMinutes: 30,
  maxUnitsPerDay: 3,
  maintenanceDecayMultiplier: 0.5,
  dormantDecayMultiplier: 0.3,
  retentionFloorRatio: 0,
}

export const defaultAppSettings: AppSettings = {
  theme: 'system',
  aiModel: 'claude-sonnet-5-5',
  aiEnabled: true,
  changeThresholdPp: 0.5,
}

export const defaultAppData: AppData = {
  schemaVersion: 1,
  settings: { ...defaultAppSettings },
  skills: [],
  events: [],
}
