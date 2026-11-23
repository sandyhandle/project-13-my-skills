import type { AppData } from '../domain/types'
import { appDataSchema } from './schemas'

export const CURRENT_SCHEMA_VERSION = 1

export function migrateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Stored data must be a JSON object')
  }

  const candidate = raw as Record<string, unknown>
  const version = typeof candidate.schemaVersion === 'number' ? candidate.schemaVersion : 0

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`This app cannot read data from schema version ${version}`)
  }

  if (version === 0) {
    candidate.schemaVersion = 1
  }

  const parsed = appDataSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new Error(`Stored data is invalid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  }

  return parsed.data as AppData
}
