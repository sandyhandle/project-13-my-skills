import type { AppData } from '../types'
import { migrateAppData } from '../../storage/migrations'

export function exportBackupJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function parseBackupJson(source: string): AppData {
  let value: unknown
  try {
    value = JSON.parse(source) as unknown
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
  return migrateAppData(value)
}

export function mergeAppData(current: AppData, incoming: AppData): AppData {
  const skills = new Map(current.skills.map((skill) => [skill.id, skill]))
  incoming.skills.forEach((skill) => skills.set(skill.id, skill))
  const events = new Map(current.events.map((event) => [event.id, event]))
  incoming.events.forEach((event) => events.set(event.id, event))
  return {
    schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
    settings: { ...current.settings, ...incoming.settings },
    skills: Array.from(skills.values()),
    events: Array.from(events.values()),
  }
}
