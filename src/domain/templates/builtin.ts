export type TemplateFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'rating'
  | 'boolean'

export interface FieldDef {
  id: string
  label: string
  type: TemplateFieldType
  options?: string[]
  placeholder?: string
}

export interface PerformanceType {
  id: string
  label: string
  factor: number
  usesAudience: boolean
}

export interface TemplateMilestone {
  id: string
  percent: number
  description: string
}

export interface TemplateConfig {
  baseGrowth?: number
  graceDays?: number
  halfLifeDays?: number
  recoveryBoost?: number
  referenceMinutes?: number
  maxUnitsPerDay?: number
  maintenanceDecayMultiplier?: number
  dormantDecayMultiplier?: number
  retentionFloorRatio?: number
}

export interface SkillTemplate {
  id: string
  label: string
  notePlaceholder: string
  fields: FieldDef[]
  performanceTypes: PerformanceType[]
  aiRubric: string
  suggestedMilestones?: TemplateMilestone[]
  suggestedConfig?: TemplateConfig
}

const milestone = (id: string, percent: number, description: string): TemplateMilestone => ({
  id,
  percent,
  description,
})

export const builtinTemplates: SkillTemplate[] = [
  {
    id: 'guitar',
    label: 'Music instrument (Guitar)',
    notePlaceholder: 'Which songs, chords, scales, or techniques did you practice? What was hard or improved?',
    fields: [
      { id: 'focus', label: 'Focus', type: 'select', options: ['Chords', 'Rhythm', 'Scales', 'Songs', 'Theory', 'Improvisation'] },
      { id: 'tempoBpm', label: 'Tempo (BPM)', type: 'number', placeholder: '80' },
      { id: 'songs', label: 'Songs', type: 'multiselect', options: [] },
    ],
    performanceTypes: [
      { id: 'recorded_video', label: 'Recorded video', factor: 1.3, usesAudience: false },
      { id: 'small_audience', label: 'Played for 1–5 people', factor: 1.6, usesAudience: true },
      { id: 'live_audience', label: 'Live audience', factor: 1.8, usesAudience: true },
    ],
    aiRubric:
      'Reward deliberate guitar practice. Repeating the same chord is low novelty; playing while singing, using a metronome, playing full songs, recording and reviewing, and performing score higher.',
  },
  {
    id: 'sport',
    label: 'Sport (Volleyball)',
    notePlaceholder: 'What drill, match, or skill did you work on? What feedback or decision-making changed?',
    fields: [
      { id: 'sessionType', label: 'Session type', type: 'select', options: ['Drill', 'Scrimmage', 'Match'] },
      { id: 'skillsWorked', label: 'Skills worked', type: 'multiselect', options: ['Serve', 'Pass', 'Set', 'Spike', 'Block', 'Defense'] },
      { id: 'intensity', label: 'Intensity', type: 'rating' },
    ],
    performanceTypes: [
      { id: 'practice_match', label: 'Practice match', factor: 1.6, usesAudience: false },
      { id: 'competitive_match', label: 'Competitive match', factor: 2.0, usesAudience: false },
      { id: 'tournament', label: 'Tournament', factor: 2.4, usesAudience: true },
    ],
    aiRubric:
      'Reward decision-making under pressure, game-like practice, and feedback from a coach. Higher difficulty and realistic conditions should score above isolated repetition.',
  },
  {
    id: 'gym',
    label: 'Gym / fitness',
    notePlaceholder: 'Which exercises, loads, sets, or reps did you complete? How was your form and effort?',
    fields: [
      { id: 'exercises', label: 'Exercises', type: 'text', placeholder: 'Squat, bench press, ...' },
      { id: 'setsReps', label: 'Sets × reps', type: 'text', placeholder: '3 × 8' },
      { id: 'load', label: 'Load', type: 'text', placeholder: 'kg or lb' },
      { id: 'rpe', label: 'RPE', type: 'rating' },
    ],
    performanceTypes: [
      { id: 'competition_pr', label: 'Competition / PR attempt', factor: 1.8, usesAudience: true },
    ],
    aiRubric:
      'Reward progressive overload, good form, challenging sessions, and consistent load progression. Penalize aimless or repetitive work without measurable progression.',
  },
  {
    id: 'language',
    label: 'Language (Marathi)',
    notePlaceholder: 'What did you practice? Which new words or expressions did you use, and in what context?',
    fields: [
      { id: 'mode', label: 'Mode', type: 'select', options: ['Vocabulary', 'Listening', 'Reading', 'Writing', 'Speaking'] },
      { id: 'wordsLearned', label: 'Words learned', type: 'number', placeholder: '10' },
      { id: 'spokeNative', label: 'Spoke with a native speaker', type: 'boolean' },
    ],
    performanceTypes: [
      { id: 'real_conversation', label: 'Real conversation', factor: 1.8, usesAudience: true },
      { id: 'recorded_speaking', label: 'Recorded speaking', factor: 1.3, usesAudience: false },
    ],
    aiRubric:
      'Real communication should score much higher than flashcards. Reward new vocabulary used in complete sentences, listening comprehension, feedback, and speaking practice.',
    suggestedMilestones: [
      milestone('marathi-0', 0, 'No practical Marathi use'),
      milestone('marathi-5', 5, 'Basic greetings and common phrases'),
      milestone('marathi-10', 10, 'Short everyday conversations'),
      milestone('marathi-20', 20, 'Comfortable with familiar topics'),
      milestone('marathi-30', 30, 'Sustained conversation with support'),
      milestone('marathi-50', 50, 'Independent conversation'),
      milestone('marathi-70', 70, 'Fluent in varied everyday contexts'),
      milestone('marathi-90', 90, 'Advanced natural expression'),
      milestone('marathi-100', 100, 'Near-native fluency'),
    ],
  },
  {
    id: 'coding',
    label: 'Coding / problem solving (Java, DSA)',
    notePlaceholder: 'What topic or project did you work on? What problem did you solve, and how?',
    fields: [
      { id: 'topic', label: 'Topic', type: 'text', placeholder: 'Graphs, dynamic programming, ...' },
      { id: 'problemsSolved', label: 'Problems solved', type: 'number', placeholder: '3' },
      { id: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy', 'Medium', 'Hard'] },
      { id: 'solvedWithoutHints', label: 'Solved without hints', type: 'boolean' },
    ],
    performanceTypes: [
      { id: 'mock_interview', label: 'Mock interview', factor: 1.8, usesAudience: true },
      { id: 'contest', label: 'Contest', factor: 2.0, usesAudience: true },
    ],
    aiRubric:
      'Reward hard problems solved without hints, explaining solutions clearly, debugging, and building real projects. Repeated easy problems and copying solutions score lower.',
  },
  {
    id: 'interview',
    label: 'Interview',
    notePlaceholder: 'Which questions did you answer? What structure or examples did you use, and what feedback did you receive?',
    fields: [
      { id: 'interviewType', label: 'Type', type: 'select', options: ['Behavioural', 'Technical', 'System design', 'HR'] },
      { id: 'questionSet', label: 'Question set', type: 'text', placeholder: 'Questions practiced' },
    ],
    performanceTypes: [
      { id: 'self_recorded_mock', label: 'Self-recorded mock', factor: 1.3, usesAudience: false },
      { id: 'mock_peer', label: 'Mock with peer', factor: 1.6, usesAudience: true },
      { id: 'mock_expert', label: 'Mock with expert', factor: 1.9, usesAudience: true },
      { id: 'real_interview', label: 'Real interview', factor: 2.5, usesAudience: true },
    ],
    aiRubric:
      'Reward feedback loops, answering aloud, structured answers such as STAR, technical depth, and reviewing weaknesses. Aimless question reading scores low.',
  },
  {
    id: 'craft',
    label: 'Craft (Knitting)',
    notePlaceholder: 'What project or technique did you work on? What was new or challenging?',
    fields: [
      { id: 'project', label: 'Project', type: 'text', placeholder: 'Scarf, sweater, ...' },
      { id: 'technique', label: 'Technique', type: 'text', placeholder: 'Cable, colorwork, ...' },
      { id: 'newStitchLearned', label: 'New stitch learned', type: 'boolean' },
    ],
    performanceTypes: [
      { id: 'finished_gifted', label: 'Finished / gifted piece', factor: 1.6, usesAudience: true },
    ],
    aiRubric:
      'Reward learning new stitches and techniques, solving mistakes, completing pieces, and finishing or gifting work over simple repetition.',
  },
  {
    id: 'generic',
    label: 'Generic',
    notePlaceholder: 'What did you practice? What was challenging, and what improved?',
    fields: [],
    performanceTypes: [
      { id: 'performed_shared', label: 'Performed / shared', factor: 1.5, usesAudience: true },
    ],
    aiRubric:
      'Use a general deliberate-practice rubric. Reward clear goals, appropriate difficulty, focus, novelty, feedback, reflection, and evidence of progress.',
  },
]

export const BUILTIN_TEMPLATES = builtinTemplates

export const templateById: Readonly<Record<string, SkillTemplate | undefined>> =
  Object.fromEntries(builtinTemplates.map((template) => [template.id, template]))

export function getTemplateById(id: string): SkillTemplate | undefined {
  return templateById[id]
}

export const MARATHI_SUGGESTED_MILESTONES: TemplateMilestone[] = [
  milestone('marathi-0', 0, 'No practical Marathi use'),
  milestone('marathi-5', 5, 'Basic greetings and common phrases'),
  milestone('marathi-10', 10, 'Short everyday conversations'),
  milestone('marathi-20', 20, 'Comfortable with familiar topics'),
  milestone('marathi-30', 30, 'Sustained conversation with support'),
  milestone('marathi-50', 50, 'Independent conversation'),
  milestone('marathi-70', 70, 'Fluent in varied everyday contexts'),
  milestone('marathi-90', 90, 'Advanced natural expression'),
  milestone('marathi-100', 100, 'Near-native fluency'),
]
