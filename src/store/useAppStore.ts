import { addDays, format, subDays } from 'date-fns'
import { create } from 'zustand'
import { defaultAppData, defaultAppSettings, defaultSkillConfig } from '../domain/defaults'
import type {
  AppData,
  AppSettings,
  PracticeSessionEvent,
  SeasonPlan,
  Skill,
  SkillConfig,
  SkillEvent,
  SkillStatus,
} from '../domain/types'
import { MARATHI_SUGGESTED_MILESTONES } from '../domain/templates'
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter'
import { appDataSchema } from '../storage/schemas'
import { clearTimelineCache } from './selectors'

const adapter = new LocalStorageAdapter()
const newId = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const today = () => format(new Date(), 'yyyy-MM-dd')
let hydratePromise: Promise<void> | null = null
let storageListenerRegistered = false

function seedFirstRun(): AppData {
  const createdOn = today()
  const createdAt = now()
  const specs: Array<{ name: string; emoji: string; category: string; templateId: string; initialLevel: number }> = [
    { name: 'Guitar', emoji: '🎸', category: 'Creative', templateId: 'guitar', initialLevel: 0.05 },
    { name: 'Knitting', emoji: '🧶', category: 'Creative', templateId: 'craft', initialLevel: 0.02 },
    { name: 'Gym', emoji: '🏋️', category: 'Physical', templateId: 'gym', initialLevel: 0.40 },
    { name: 'Java', emoji: '☕', category: 'Technical', templateId: 'coding', initialLevel: 0.55 },
    { name: 'Coding & Problem Solving', emoji: '💻', category: 'Technical', templateId: 'coding', initialLevel: 0.45 },
    { name: 'Interview', emoji: '🎤', category: 'Communication', templateId: 'interview', initialLevel: 0.20 },
    { name: 'Marathi', emoji: '🗣️', category: 'Communication', templateId: 'language', initialLevel: 0.03 },
  ]

  const skills: Skill[] = specs.map((item) => ({
    id: newId(),
    ...item,
    milestones: item.templateId === 'language' ? MARATHI_SUGGESTED_MILESTONES.map((item) => ({ ...item })) : [],
    createdOn,
    archived: false,
  }))

  const events: SkillEvent[] = skills.map((skill) => ({
    id: newId(),
    skillId: skill.id,
    date: createdOn,
    createdAt,
    type: 'skill_created',
    initialLevel: skills.find((item) => item.id === skill.id)?.id === skill.id
      ? specs.find((item) => item.name === skill.name)?.initialLevel ?? 0
      : 0,
    config: { ...defaultSkillConfig },
    status: 'active',
  }))

  return {
    schemaVersion: 1,
    settings: { ...defaultAppSettings },
    skills,
    events,
  }
}

function loadDemoHistory(current: AppData): AppData {
  if (current.skills.length === 0) current = seedFirstRun()
  const events = [...current.events]
  const demoSkills = current.skills.map((skill) => ({ ...skill, demo: true }))

  for (const skill of demoSkills) {
    const created = events.find((event) => event.skillId === skill.id && event.type === 'skill_created')
    if (!created) continue
    const start = subDays(new Date(), 330)
    for (let index = 0; index < 12; index += 1) {
      const sessions = 2 + (index % 3)
      for (let session = 0; session < sessions; session += 1) {
        const date = format(addDays(start, index * 28 + session * 2), 'yyyy-MM-dd')
        events.push({
          id: newId(),
          skillId: skill.id,
          date,
          createdAt: `${date}T12:00:00.000Z`,
          type: 'practice_session',
          minutes: 30 + (session % 3) * 15,
          notes: `Demo practice session ${index + 1}.${session + 1}`,
          performance: { performed: session === sessions - 1 },
          templateFields: {},
          selfRating: 4,
          ai: undefined,
        })
      }
    }
  }

  return { ...current, skills: demoSkills, events }
}

interface AppStore extends AppData {
  isLoading: boolean
  storageError: string | null
  hydrate(): Promise<void>
  persist(): Promise<void>
  updateSettings(patch: Partial<AppSettings>): void
  addSkill(skill: Omit<Skill, 'id'> & { initialLevel?: number; config?: SkillConfig }): Skill
  updateSkill(id: string, patch: Partial<Skill>): void
  deleteSkill(id: string): void
  archiveSkill(id: string, archived: boolean): void
  logSession(session: Omit<PracticeSessionEvent, 'id' | 'createdAt'>): PracticeSessionEvent
  updateSession(id: string, patch: Partial<PracticeSessionEvent>): void
  deleteEvent(id: string): void
  adjustLevel(skillId: string, date: string, newLevel: number, reason: string, lowerPeakToo: boolean): void
  changeConfig(skillId: string, date: string, config: SkillConfig): void
  changeStatus(skillId: string, date: string, status: SkillStatus, reason?: string): void
  startSeason(skillId: string, date: string, plan: SeasonPlan): void
  endSeason(skillId: string, date: string, outcome: string, nextStatus: SkillStatus, revisitDate?: string): void
  importData(data: AppData): void
  resetData(): void
  loadDemoHistory(): void
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...defaultAppData,
  isLoading: true,
  storageError: null,

  hydrate: () => {
    if (hydratePromise) return hydratePromise
    hydratePromise = (async () => {
      try {
        const loaded = await adapter.load()
        const data = loaded ?? seedFirstRun()
        if (!loaded) await adapter.save(data)
        set({ ...data, isLoading: false, storageError: null })
        if (typeof window !== 'undefined' && !storageListenerRegistered) {
          window.addEventListener('storage', (event) => {
            if (event.key !== 'skill-progress-tracker:v1') return
            void get().hydrate()
          })
          storageListenerRegistered = true
        }
      } catch (error) {
        set({
          isLoading: false,
          storageError: error instanceof Error ? error.message : 'Could not load stored data',
        })
      } finally {
        hydratePromise = null
      }
    })()
    return hydratePromise
  },

  persist: async () => {
    const state = get()
    await adapter.save({
      schemaVersion: state.schemaVersion,
      settings: state.settings,
      skills: state.skills,
      events: state.events,
    })
  },

  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
  addSkill: (skill) => {
    const { initialLevel, config } = skill
    const created: Skill = {
      id: newId(),
      name: skill.name,
      emoji: skill.emoji,
      category: skill.category,
      templateId: skill.templateId,
      milestones: skill.milestones,
      createdOn: skill.createdOn,
      archived: skill.archived,
    }
    const event: SkillEvent = {
      id: newId(),
      skillId: created.id,
      date: skill.createdOn,
      createdAt: now(),
      type: 'skill_created',
      initialLevel: initialLevel ?? 0,
      config: config ? { ...config } : { ...defaultSkillConfig },
      status: 'active',
    }
    set((state) => ({ skills: [...state.skills, created], events: [...state.events, event] }))
    clearTimelineCache()
    return created
  },
  updateSkill: (id, patch) => set((state) => ({
    skills: state.skills.map((skill) => skill.id === id ? { ...skill, ...patch } : skill),
  })),
  deleteSkill: (id) => set((state) => ({
    skills: state.skills.filter((skill) => skill.id !== id),
    events: state.events.filter((event) => event.skillId !== id),
  })),
  archiveSkill: (id, archived) => set((state) => ({
    skills: state.skills.map((skill) => skill.id === id ? { ...skill, archived } : skill),
  })),
  logSession: (session) => {
    const event: PracticeSessionEvent = { ...session, id: newId(), createdAt: now() }
    set((state) => ({ events: [...state.events, event] }))
    clearTimelineCache()
    return event
  },
  updateSession: (id, patch) => {
    set((state) => ({
      events: state.events.map((event) => event.id === id ? { ...event, ...patch } as SkillEvent : event),
    }))
    clearTimelineCache()
  },
  deleteEvent: (id) => {
    set((state) => ({
      events: state.events.filter((event) => event.id !== id),
    }))
    clearTimelineCache()
  },
  adjustLevel: (skillId, date, newLevel, reason, lowerPeakToo) => {
    set((state) => ({
      events: [...state.events, {
        id: newId(), skillId, date, createdAt: now(), type: 'manual_adjustment',
        newLevel, reason, lowerPeakToo,
      }],
    }))
    clearTimelineCache()
  },
  changeConfig: (skillId, date, config) => {
    set((state) => ({
      events: [...state.events, {
        id: newId(), skillId, date, createdAt: now(), type: 'config_changed', config,
      }],
    }))
    clearTimelineCache()
  },
  changeStatus: (skillId, date, status, reason) => {
    set((state) => ({
      events: [...state.events, {
        id: newId(), skillId, date, createdAt: now(), type: 'status_changed', status, reason,
      }],
    }))
    clearTimelineCache()
  },
  startSeason: (skillId, date, plan) => {
    set((state) => ({
      events: [...state.events, {
        id: newId(), skillId, date, createdAt: now(), type: 'season_started', plan,
      }],
    }))
    clearTimelineCache()
  },
  endSeason: (skillId, date, outcome, nextStatus, revisitDate) => {
    set((state) => ({
      events: [...state.events, {
        id: newId(), skillId, date, createdAt: now(), type: 'season_ended',
        outcome, nextStatus, revisitDate,
      }],
    }))
    clearTimelineCache()
  },
  importData: (data) => {
    const parsed = appDataSchema.parse(data)
    set({ ...parsed as AppData, storageError: null })
    clearTimelineCache()
  },
  resetData: () => set({ ...defaultAppData, settings: { ...defaultAppSettings }, isLoading: false, storageError: null }),
  loadDemoHistory: () => set((state) => ({
    ...loadDemoHistory({
      schemaVersion: state.schemaVersion,
      settings: state.settings,
      skills: state.skills,
      events: state.events,
    }),
  })),
}))

useAppStore.subscribe((state, previousState) => {
  if (
    state.schemaVersion === previousState.schemaVersion &&
    state.settings === previousState.settings &&
    state.skills === previousState.skills &&
    state.events === previousState.events
  ) {
    return
  }
  void state.persist()
})
