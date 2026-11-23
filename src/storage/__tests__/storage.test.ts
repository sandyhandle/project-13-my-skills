import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppData, defaultAppSettings, defaultSkillConfig } from '../../domain/defaults'
import type { AppData } from '../../domain/types'
import { LocalStorageAdapter, STORAGE_KEY } from '../LocalStorageAdapter'
import { StorageValidationError } from '../StorageAdapter'
import { appDataSchema } from '../schemas'
import { CURRENT_SCHEMA_VERSION, migrateAppData } from '../migrations'

function validData(): AppData {
  return {
    ...defaultAppData,
    settings: { ...defaultAppSettings },
  }
}

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('validates a complete app payload', () => {
    expect(appDataSchema.safeParse(validData()).success).toBe(true)
  })

  it('loads null on first run and round-trips saved data', async () => {
    const adapter = new LocalStorageAdapter(localStorage)
    expect(await adapter.load()).toBeNull()

    await adapter.save(validData())
    expect(await adapter.load()).toEqual(validData())
  })

  it('debounces repeated writes by 300ms', async () => {
    vi.useFakeTimers()
    const setItem = vi.fn()
    const memoryStorage = {
      getItem: vi.fn(() => null),
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    } as unknown as Storage
    const adapter = new LocalStorageAdapter(memoryStorage)

    void adapter.save(validData())
    void adapter.save({ ...validData(), settings: { ...defaultAppSettings, theme: 'dark' } })
    await vi.advanceTimersByTimeAsync(299)
    expect(setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(setItem).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('rejects malformed localStorage data with the raw value preserved', async () => {
    localStorage.setItem(STORAGE_KEY, '{"schemaVersion":1}')
    const adapter = new LocalStorageAdapter(localStorage)

    await expect(adapter.load()).rejects.toBeInstanceOf(StorageValidationError)
  })

  it('rejects newer schema versions', () => {
    expect(() => migrateAppData({ ...validData(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      /cannot read data/,
    )
  })

  it('migrates legacy missing schema versions to version 1', () => {
    const migrated = migrateAppData({
      settings: defaultAppSettings,
      skills: [],
      events: [],
    })
    expect(migrated.schemaVersion).toBe(1)
  })

  it('validates events and nested skill configuration', () => {
    const data: AppData = {
      ...validData(),
      skills: [{
        id: 'skill-1',
        name: 'Guitar',
        templateId: 'guitar',
        milestones: [],
        createdOn: '2026-11-23',
        archived: false,
      }],
      events: [{
        id: 'event-1',
        skillId: 'skill-1',
        date: '2026-11-23',
        createdAt: '2026-11-23T12:00:00.000Z',
        type: 'skill_created',
        initialLevel: 0.05,
        config: { ...defaultSkillConfig },
        status: 'active',
      }],
    }
    expect(appDataSchema.safeParse(data).success).toBe(true)
  })
})
