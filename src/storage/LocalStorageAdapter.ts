import type { AppData } from '../domain/types'
import { migrateAppData } from './migrations'
import { StorageAdapter, StorageValidationError } from './StorageAdapter'

export const STORAGE_KEY = 'skill-progress-tracker:v1'

export class LocalStorageAdapter implements StorageAdapter {
  private timer: ReturnType<typeof setTimeout> | null = null
  private latestSave: Promise<void> = Promise.resolve()

  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  async load(): Promise<AppData | null> {
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch (error) {
      throw new Error(`Could not access localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    if (raw === null) return null

    try {
      return migrateAppData(JSON.parse(raw))
    } catch (error) {
      throw new StorageValidationError(
        error instanceof Error ? error.message : 'Invalid stored data',
        raw,
      )
    }
  }

  async save(data: AppData): Promise<void> {
    if (this.timer) clearTimeout(this.timer)

    this.latestSave = new Promise<void>((resolve, reject) => {
      this.timer = setTimeout(() => {
        try {
          this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
          resolve()
        } catch (error) {
          reject(error)
        } finally {
          this.timer = null
        }
      }, 300)
    })

    await this.latestSave
  }

  flush(data: AppData): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
