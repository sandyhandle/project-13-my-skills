import type { AppData } from '../domain/types'

export interface StorageAdapter {
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
}

export class StorageValidationError extends Error {
  constructor(message: string, public readonly rawData?: string) {
    super(message)
    this.name = 'StorageValidationError'
  }
}
