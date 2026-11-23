# Skill Progress Tracker — Full Project Spec (for GitHub Copilot in VS Code)

> **How to use this file:** Put it in the repo root as `SPEC.md`. Copy section 15 into `.github/copilot-instructions.md`. Then build phase by phase using the prompts in section 14. Always tell Copilot: *"Read SPEC.md first. Follow sections X–Y."*

---

## 1. Product Summary

A personal, frontend-only web app that answers: **"How capable am I at each skill right now, and how has that changed over time?"**

- **NOT a habit tracker.** No streaks, no "did you practice today" nagging.
- **Practice is input. Skill % is output.** A practice session is *evidence of effort*; skill % is *estimated capability*.
- Skill % grows with practice (diminishing returns), decays after inactivity (grace period + exponential decay), and recovers faster after decay.
- Each practice session is scored (by AI, with a non-AI fallback) based on **what was written, how long, and whether it was performed**.
- Skills are **seasonal**: a skill can have a goal + time period (e.g. "Interview prep, daily, until I get a job"), then go dormant for years and still be remembered.
- Everything is stored as **dated events**, so any past radar chart can be reconstructed.
- Only one user. No backend. Data lives in `localStorage`, with easy **export** (JSON backup + Notion-ready copy/paste).

Core chain: **Practice → Learning → Skill Growth → Retention/Decay → Current Capability**

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) + Vite |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), CSS variables for theme tokens |
| Charts | Recharts (RadarChart, LineChart/AreaChart) |
| State | Zustand (+ custom persistence via StorageAdapter) |
| Routing | react-router-dom v6 |
| Validation | zod (storage load, import, AI responses) |
| Dates | date-fns (use date-only strings `YYYY-MM-DD`, local time) |
| Animation | framer-motion (respect `prefers-reduced-motion`) |
| Icons | lucide-react |
| Tests | Vitest + @testing-library/react |
| AI | Anthropic Messages API called directly from the browser with the user's own API key |

No other runtime deps without a reason.

---

## 3. Folder Structure

```
skill-progress-tracker/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ SPEC.md
├─ .github/copilot-instructions.md
└─ src/
   ├─ main.tsx
   ├─ App.tsx                      # layout shell, theme, routes
   ├─ styles/index.css             # tailwind + theme tokens
   ├─ lib/
   │  ├─ dates.ts                  # today(), addDays(), diffDays(), formatters (date-only strings)
   │  ├─ format.ts                 # pct(), pp(), duration(minutes)
   │  └─ id.ts                     # uuid via crypto.randomUUID
   ├─ domain/                      # PURE TypeScript. No React. No localStorage. Fully unit-tested.
   │  ├─ types.ts                  # all types (section 5)
   │  ├─ defaults.ts               # default SkillConfig, app settings
   │  ├─ engine/
   │  │  ├─ simulate.ts            # replay events -> daily timeline
   │  │  ├─ growth.ts              # session units + growth formula + recovery
   │  │  ├─ decay.ts               # half-life <-> k, daily decay step
   │  │  ├─ snapshots.ts           # level at date, radar snapshots
   │  │  ├─ periods.ts             # period selector -> snapshot dates
   │  │  ├─ milestones.ts          # current/next milestone
   │  │  ├─ stats.ts               # session counts, minutes, improving/declining/stable
   │  │  ├─ planProgress.ts        # season/plan analysis
   │  │  └─ __tests__/*.test.ts
   │  ├─ templates/
   │  │  ├─ builtin.ts             # skill templates (section 8)
   │  │  └─ index.ts
   │  ├─ ai/
   │  │  ├─ client.ts              # fetch wrapper for Anthropic API
   │  │  ├─ prompts.ts             # system + user prompt builders
   │  │  ├─ schema.ts              # zod schemas for AI responses
   │  │  ├─ scoreSession.ts        # AI scoring + retry + fallback
   │  │  ├─ fallbackScore.ts       # deterministic scoring without AI
   │  │  ├─ monthlyReview.ts       # AI calibration suggestion
   │  │  └─ draftMilestones.ts     # AI milestone drafts (optional)
   │  └─ export/
   │     ├─ notionMarkdown.ts      # dated copy-paste markdown
   │     ├─ notionCsv.ts           # CSV for Notion database import
   │     └─ backupJson.ts          # full JSON export/import + validation
   ├─ storage/
   │  ├─ StorageAdapter.ts         # interface (load/save) so a backend can replace it later
   │  ├─ LocalStorageAdapter.ts
   │  └─ migrations.ts             # schemaVersion migrations
   ├─ store/
   │  ├─ useAppStore.ts            # zustand: data + actions
   │  └─ selectors.ts              # memoized derived data (timelines, snapshots)
   ├─ features/
   │  ├─ dashboard/                # DashboardPage, RadarPanel, PeriodSelector, SummaryStrip, SkillCardGrid
   │  ├─ skill-detail/             # SkillDetailPage, HistoryChart, MilestoneCard, SessionList, AdjustmentList, PlanCard
   │  ├─ skill-form/               # SkillFormModal (add/edit), MilestoneEditor, GrowthPreview
   │  ├─ session/                  # LogSessionModal, PerformanceInput, AiScorePanel, TemplateFields
   │  ├─ checkin/                  # MonthlyCheckin
   │  ├─ export/                   # ExportPage (Notion + JSON)
   │  └─ settings/                 # SettingsPage (API key, theme, defaults, data tools)
   └─ components/ui/               # Button, Card, Modal, Input, Select, Slider, Tabs, Badge, EmptyState, Toast, ProgressRing
```

**Rule:** `domain/` never imports from React, zustand, or browser APIs (except `fetch` inside `domain/ai/client.ts`). This keeps the engine testable and portable to a future backend.

---

## 4. Key Concepts & Rules

1. **Internal skill level is a fraction 0–1.** UI shows percent (1 decimal). Radar domain is 0–100.
2. **Event sourcing.** The source of truth is a list of dated events. Skill level on any date is *derived* by replaying events day by day. Never store "current level" as the only truth (a cached value is OK, but must be recomputable).
3. **Dates are date-only strings** (`YYYY-MM-DD`, user's local day). Use calendar-day differences (`differenceInCalendarDays`) to avoid DST bugs.
4. **Config changes are events**, so changing growth/decay settings later does not rewrite history.
5. **Editing or deleting a past event recomputes everything after it** (deterministic replay).
6. **Level can never go below 0 or above 1.**
7. Practice never adds a fixed percentage; it contributes "units" that pass through the growth formula.

---

## 5. Data Model (TypeScript)

```ts
type ISODate = string; // 'YYYY-MM-DD'
type ISODateTime = string;

type SkillStatus = 'active' | 'maintenance' | 'dormant';

interface Milestone { id: string; percent: number /*0-100*/; description: string }

interface SkillConfig {
  baseGrowth: number;               // growth per 1.0 unit at level 0, as fraction (0.002 = 0.2 pp)
  graceDays: number;                // days without practice before decay starts (default 7)
  halfLifeDays: number;             // after grace, level halves every N days (default 180)
  recoveryBoost: number;            // growth multiplier strength while below peak (default 2)
  referenceMinutes: number;         // minutes that count as 1.0 duration factor (default 30)
  maxUnitsPerDay: number;           // cap on total units per day (default 3)
  maintenanceDecayMultiplier: number; // k multiplier when status = maintenance (default 0.5)
  dormantDecayMultiplier: number;     // k multiplier when status = dormant (default 0.3)
  retentionFloorRatio: number;      // 0..1; level never decays below peak * ratio (default 0 = off)
}

interface Skill {
  id: string;
  name: string;
  emoji?: string;
  category?: string;                // free text; suggestions: Physical, Technical, Creative, Communication
  templateId: string;               // see section 8
  milestones: Milestone[];
  createdOn: ISODate;
  archived: boolean;                // hidden everywhere except Settings > Archived
}

type SkillEvent =
  | SkillCreatedEvent
  | PracticeSessionEvent
  | ManualAdjustmentEvent
  | ConfigChangedEvent
  | StatusChangedEvent
  | SeasonStartedEvent
  | SeasonEndedEvent;

interface BaseEvent { id: string; skillId: string; date: ISODate; createdAt: ISODateTime }

interface SkillCreatedEvent extends BaseEvent {
  type: 'skill_created';
  initialLevel: number;             // 0..1
  config: SkillConfig;
  status: SkillStatus;
}

interface PracticeSessionEvent extends BaseEvent {
  type: 'practice_session';
  minutes: number;
  notes: string;                    // what I did (free text) - main input for AI
  performance: {
    performed: boolean;
    typeId?: string;                // from template.performanceTypes
    audienceSize?: number;
    link?: string;                  // recording/video link
    notes?: string;
  };
  templateFields: Record<string, string | number | boolean | string[]>;
  selfRating?: 1 | 2 | 3 | 4 | 5;   // used by fallback scoring
  ai?: AiScore;                     // AI result (if run)
  pointsOverride?: number;          // user can override final points 0..100
}

interface ManualAdjustmentEvent extends BaseEvent {
  type: 'manual_adjustment';
  newLevel: number;                 // 0..1
  reason: string;
  lowerPeakToo: boolean;            // if true and newLevel < peak, peak = newLevel (correcting an over-estimate)
}

interface ConfigChangedEvent extends BaseEvent { type: 'config_changed'; config: SkillConfig }
interface StatusChangedEvent extends BaseEvent { type: 'status_changed'; status: SkillStatus; reason?: string }

interface SeasonPlan {
  goal: string;                     // "Get a job offer"
  targetDate?: ISODate;
  targetLevel?: number;             // 0..1 optional
  sessionsPerWeek: number;          // planned cadence
  minutesPerSession?: number;
  endCondition?: string;            // "When I accept an offer"
  revisitDate?: ISODate;            // e.g. 2-3 years later
}
interface SeasonStartedEvent extends BaseEvent { type: 'season_started'; plan: SeasonPlan }
interface SeasonEndedEvent extends BaseEvent {
  type: 'season_ended';
  outcome: string;                  // "Got the job at X"
  nextStatus: SkillStatus;          // usually 'dormant' or 'maintenance'
}

interface AiScore {
  points: number;                   // 0..100 overall session points (engine uses this)
  difficulty: number;               // 0..100
  novelty: number;                  // 0..100 (new vs repeated material)
  focus: number;                    // 0..100
  performanceImpact: number | null; // 0..100, null if not performed
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSessionSuggestion: string;
  milestoneEvidence: string | null; // evidence toward the next milestone
  model: string;
  scoredAt: ISODateTime;
}

interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  anthropicApiKey?: string;         // stored in localStorage, personal use only
  aiModel: string;                  // default 'claude-sonnet-5-5' (verify at docs.claude.com)
  aiEnabled: boolean;
  lastExportAt?: ISODateTime;
  lastCheckinAt?: ISODateTime;
  changeThresholdPp: number;        // default 0.5 -> improving/declining cutoff
}

interface AppData {
  schemaVersion: number;            // start at 1
  settings: AppSettings;
  skills: Skill[];
  events: SkillEvent[];             // all events, all skills
}
```

---

## 6. Calculation Engine (the heart of the app)

### 6.1 Replay algorithm (`simulateSkill`)

Input: `skill`, its events (sorted by `date`, then `createdAt`), `untilDate`.
Output: `DailyPoint[]` from `createdOn` to `untilDate`:

```ts
interface DailyPoint {
  date: ISODate; level: number; peak: number; status: SkillStatus;
  inactiveDays: number; decaying: boolean; recovering: boolean; // recovering = level < peak
  sessionCount: number; minutes: number; delta: number;        // delta = level change that day
}
```

State: `level`, `peak`, `config`, `status`, `lastPracticeDate`.

For each calendar day `d` from `createdOn` to `untilDate`:

1. Apply non-practice events of that day in order:
   - `skill_created` → `level = initialLevel`, `peak = initialLevel`, `config`, `status`, `lastPracticeDate = d`
   - `config_changed` → replace config
   - `status_changed` / `season_ended` → set status
   - `manual_adjustment` → `level = newLevel`; `peak = max(peak, level)` normally; if `lowerPeakToo && newLevel < peak` then `peak = newLevel`. Manual adjustments do **not** reset `lastPracticeDate`.
   - `season_started` → no level effect (analysis only)
2. If the day has practice sessions: process them in order, tracking `unitsUsedToday` (stop adding once `maxUnitsPerDay` reached):
   - `units = sessionUnits(session, config)` (6.2), clamped to remaining daily cap
   - `growth = config.baseGrowth * units * (1 - level) * recoveryMultiplier`
   - `level = min(1, level + growth)`; `peak = max(peak, level)`
   - `lastPracticeDate = d`
3. Else (no practice that day): `inactiveDays = diffDays(d, lastPracticeDate)`. If `inactiveDays > graceDays`, apply **one daily decay step** (6.3).
4. Clamp `level` to `[0, 1]`. Record the `DailyPoint`.

**Recovery multiplier:** `recoveryMultiplier = level < peak ? 1 + recoveryBoost * ((peak - level) / peak) : 1`
This makes relearning faster than learning, and growth naturally pushes beyond the old peak.

### 6.2 Session units (practice → growth input)

```
durationFactor    = min(minutes / referenceMinutes, 2)
qualityFactor     = 0.25 + 1.5 * (points / 100)        // points 0..100 → 0.25..1.75 (points=50 → 1.0)
performanceFactor = performed ? templatePerformanceType.factor + audienceBonus : 1.0
units             = durationFactor * qualityFactor * performanceFactor
```

- `points` = `pointsOverride ?? ai.points ?? fallbackScore(...)`.
- `audienceBonus`: 0 for audience 0–9, +0.2 for 10–49, +0.5 for 50–199, +0.8 for 200+ (only for performance types with `usesAudience = true`).
- Per-session cap: `units ≤ 3`; per-day cap: `maxUnitsPerDay`.

### 6.3 Decay (exponential, after grace period)

```
k = ln(2) / halfLifeDays
effectiveInactiveDays = max(0, inactiveDays - graceDays)
level(t) = level0 * e^(-k * effectiveInactiveDays)
```

Implemented as a **daily step**: `level = level * e^(-k * statusMultiplier)` on every inactive day beyond grace. (A product of daily steps equals the closed formula when the multiplier is constant.)
Where `statusMultiplier` = 1 (active), `maintenanceDecayMultiplier`, or `dormantDecayMultiplier`.
If `retentionFloorRatio > 0`: `level = max(level, peak * retentionFloorRatio)`.

UI shows **half-life** ("loses half its level every ~180 days after the grace period") and, in an "advanced" line, the raw `k`.
Note: a decay rate like "0.2%/day" equals `k = 0.002` → half-life ≈ 347 days. Provide a converter in the form.

### 6.4 Growth calibration (important!)

`baseGrowth` is per **standard session unit** (30 min, quality 50, no performance). If `baseGrowth = 1pp` and you practice daily, you would gain ~25pp in a month from zero — far too fast. Therefore:

- Default `baseGrowth = 0.002` (0.2 pp per standard session at level 0).
- In the skill form show a **GrowthPreview**: "Practicing a standard session daily for 30 days: 20% → X%" (computed by running the engine on synthetic sessions).
- Offer an alternative input: **"Expected gain per month of regular practice (pp)"** with sessions/week; solve for `baseGrowth` (binary search using the engine). Store only `baseGrowth`.

### 6.5 Snapshots, periods, comparisons

- `levelAt(skillId, date)` → level from the timeline (null if the skill didn't exist yet).
- `snapshot(date)` → map `skillId → level|null` for all non-archived skills.
- **Period selector** `Current | Day | Week | Month | 3 Months | 6 Months | Year` (no "All Time"). Snapshot dates relative to today:

| Period | Shapes drawn on radar (oldest → newest) |
|---|---|
| Current | now only |
| Day | −1d, now |
| Week | −7d, now |
| Month | −30d, −15d, now |
| 3 Months | −90d, −60d, −30d, now |
| 6 Months | −180d, −120d, −60d, now |
| Year | −365d, −270d, −180d, −90d, now |

- Older shapes: lighter color + lower opacity; "now" is the strong filled shape.
- Also add a **"Compare with…" date picker** for arbitrary historical comparison (e.g. "Current vs 3 months ago" or any chosen date).
- Skills that did not exist at an older date: plot 0 with a dashed marker and tooltip "not started yet".
- **Change per skill** = `(levelNow − levelAtPeriodStart)` in percentage points. For `Current`, use the last 30 days for summary stats.
- **Improving / Declining / Stable** use `settings.changeThresholdPp` (default 0.5 pp).

### 6.6 Milestones

- Current milestone = highest milestone with `percent ≤ level`.
- Next milestone = lowest milestone with `percent > level`.
- Show progress between them (bar). Milestones are optional, editable, per skill, and personal.

### 6.7 Plan / season progress (`planProgress.ts`)

For a skill with an active season:
- `weeksElapsed`, `plannedSessions = sessionsPerWeek * weeksElapsed`, `actualSessions`, `adherence = actual/planned`
- `paceRecent` = pp/week over the last 4 weeks
- `projectedLevelAtTarget`: continue the simulation forward to `targetDate` assuming the planned cadence and the average points of the last 10 sessions
- Verdict: `ahead | on_track | behind` (compare projected vs `targetLevel` when set, else adherence thresholds ≥1.1 / 0.8)
- `season_ended` action: asks for an outcome note → sets status (default `dormant`) and optional `revisitDate`.
- A skill can have many seasons over the years ("Interview 2026–27", "Interview 2029"). History stays; dormant skills keep their peak so the **recovery bonus** helps on return.

### 6.8 Performance & caching

- Memoize each skill's timeline by a hash of (events + untilDate). Recompute only the affected skill when its events change.
- 10 years × 365 days × ~20 skills is fine; avoid re-simulating on every render.

---

## 7. Practice Session Logging (the "tool where I put what I did")

**LogSessionModal** (also a global floating "＋ Log session" button, and a button on each skill page):

Fields:
1. Skill (select, preselected on the skill page)
2. Date (default today; past dates allowed, future not)
3. Duration (minutes; quick buttons 15 / 30 / 45 / 60 / 90; also accepts "1h 20m")
4. **What I did** (large textarea; template-specific prompt placeholders, e.g. "Which songs/chords/techniques? What was hard? What improved?")
5. **Template fields** (section 8), e.g. Guitar: "Focus type", "Tempo (BPM)", "Songs"
6. **Did I perform?** toggle
   - If yes: performance type (from template), audience size (when relevant), optional link to recording, optional notes ("how did it go?")
7. Self-rating (1–5 "how focused was I") — used by the fallback scorer and passed to AI
8. Buttons: **Save & score with AI**, **Save (use fallback score)**, **Save without scoring**

After saving, show **AiScorePanel**: points ring (0–100), difficulty/novelty/focus bars, performance impact, summary, strengths, improvements, next-session suggestion, "Growth from this session: +0.18 pp → 24.3%". User can:
- **Override points** (slider) → stored as `pointsOverride`
- **Re-run AI** (replaces the `ai` payload)
- **Edit/Delete session** (events replay everything)

If AI fails or is disabled: use `fallbackScore` and show a "scored without AI" badge.

---

## 8. Skill Templates (different skills have different procedures)

```ts
interface FieldDef { id: string; label: string; type: 'text'|'number'|'select'|'multiselect'|'rating'|'boolean'; options?: string[]; placeholder?: string }
interface PerformanceType { id: string; label: string; factor: number; usesAudience: boolean }
interface SkillTemplate {
  id: string; label: string;
  notePlaceholder: string;
  fields: FieldDef[];
  performanceTypes: PerformanceType[];     // empty array = performing not applicable
  aiRubric: string;                        // text injected into the AI prompt
  suggestedMilestones?: Milestone[];
  suggestedConfig?: Partial<SkillConfig>;
}
```

Built-in templates (implement these in `builtin.ts`; user can pick one when adding a skill; "Generic" is the default):

| Template | Extra fields | Performance types (factor) | Rubric highlights |
|---|---|---|---|
| **Music instrument** (Guitar) | Focus (chords / rhythm / scales / songs / theory / improvisation), Tempo BPM, Songs | Recorded video 1.3, Played for 1–5 people 1.6, Live audience 1.8 (+audience bonus) | Repeating the same chord is low novelty; playing while singing, playing with a metronome, playing full songs, recording and reviewing, and performing score higher |
| **Sport** (Volleyball) | Session type (drill / scrimmage / match), Skills worked (serve, pass, set, spike, block, defense), Intensity | Practice match 1.6, Competitive match 2.0, Tournament 2.4 | Reward decision-making under pressure, game-like practice, feedback from coach |
| **Gym / fitness** | Exercises, Sets×reps, Load, RPE | Competition / PR attempt 1.8 | Progressive overload, form, consistency of load progression |
| **Language** (Marathi) | Mode (vocabulary / listening / reading / writing / speaking), Words learned, Spoke with a native speaker (bool) | Real conversation 1.8 (+audience), Recorded speaking 1.3 | Real communication >> flashcards; new vocabulary used in sentences scores higher |
| **Coding / problem solving** (Java, DSA) | Topic, Problems solved, Difficulty (easy/med/hard), Solved without hints (bool) | Mock interview 1.8, Contest 2.0 | Hard problems without hints, explaining solutions, building real projects |
| **Interview** | Type (behavioural / technical / system design / HR), Question set | Self-recorded mock 1.3, Mock with peer 1.6, Mock with expert 1.9, Real interview 2.5 | Feedback loops, answering aloud, structured answers (STAR) |
| **Craft** (Knitting) | Project, Technique, New stitch learned (bool) | Finished/gifted piece 1.6 | New techniques and completed pieces over repetition |
| **Generic** | none | Performed/shared 1.5 | General deliberate-practice rubric |

Templates only change the **form fields, performance options and AI rubric**; the engine is the same for every skill.

---

## 9. AI Scoring

### 9.1 Client (`domain/ai/client.ts`)

`POST https://api.anthropic.com/v1/messages`
Headers: `x-api-key: <user key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`, **`anthropic-dangerous-direct-browser-access: true`** (required for browser calls).
Body: `{ model, max_tokens: 1200, system, messages: [{ role: 'user', content }] }`.
Model comes from `settings.aiModel` (default `claude-sonnet-5-5`; user-editable).

Settings page must show a clear note: *"Your notes and API key are sent from this browser directly to Anthropic. The key is stored only in this browser's localStorage. Use only on your personal device."*

### 9.2 Scoring request

System prompt (builder in `prompts.ts`) must instruct the model to:
- Act as a strict, consistent skills coach evaluating **one practice session**.
- Use the skill's **rubric** and **current level + next milestone** as context.
- Score `points` 0–100 where **50 = a solid, typical session**; avoid inflation; penalize aimless repetition of already-mastered material; reward deliberate practice, stretch difficulty, feedback loops (recording, reviewing, coaching), novelty and **performance**.
- Be consistent with prior scores (provide the last 10 sessions: date, minutes, short notes, points).
- If `performed = true`, produce `performanceImpact`; else `null`.
- **Return ONLY valid JSON** matching the `AiScore` shape (without `model`/`scoredAt`).

User message includes: skill name, template rubric, current level %, current/next milestone, last 10 sessions, and this session (date, minutes, notes, template fields, performance details, self-rating).

Validate with zod. On invalid JSON, retry once with "Return only JSON." If it still fails, use `fallbackScore`. Handle 401/429/network errors with friendly toasts.

### 9.3 Fallback score (no AI)

```
base = 40
+ min(notes.length / 20, 15)            // detail of notes (cap +15)
+ (selfRating ? (selfRating - 3) * 8 : 0)
+ (performed ? 15 : 0)
clamp 0..100
```
Always labelled "estimated (no AI)".

### 9.4 Monthly calibration check-in (`MonthlyCheckin`)

Banner when `lastCheckinAt` is >30 days old. For each active/maintenance skill:
- Show current %, current milestone, last 30 days of sessions.
- AI (`monthlyReview.ts`) returns `{ suggestedLevel, confidence, reasoning }` from milestones + notes. **Never auto-applies.**
- Buttons: *Feels right* · *Adjust to …* (creates a `manual_adjustment` event).

### 9.5 Optional: AI milestone drafts

In the skill form: "Draft milestones with AI" → returns 6–9 milestones (0/5/10/20/30/50/70/90/100) as editable rows.

---

## 10. Screens & UX

### 10.1 Layout
- Top bar: logo/name, theme toggle, **＋ Log session**, **＋ Add skill**, nav links (Dashboard, Export, Settings).
- Mobile: bottom tab bar (Dashboard, Log, Export, Settings); radar on top, cards below.
- Routes: `/` · `/skills/:id` · `/export` · `/settings`. Add/Edit skill and Log session are modals.

### 10.2 Dashboard (`/`)
1. **Tagline strip**: "Habits measure whether I showed up. Skills measure what I became capable of."
2. **PeriodSelector** (segmented control) + "Compare with…" date picker + category filter chips (All by default).
3. **RadarPanel** (the primary visual, large, centered):
   - One axis per non-archived skill (dormant ones hidden by default; toggle "Show dormant").
   - Radius 0 at center, 100 at outer edge, grid rings at 25/50/75/100.
   - Custom axis labels: `Skill  24%` (emoji + name + current %); label is **clickable** → skill detail page.
   - Multi-series overlay per period table (section 6.5); legend shows the dates.
   - Smooth animation when values change; tooltip with exact values and change.
   - With fewer than 3 skills: show a horizontal bar fallback with a hint.
4. **SummaryStrip**: Total Skills · Improving · Declining · Stable · Practice Sessions This Month · Total Practice Time This Month. (No streaks.)
5. **SkillCardGrid**: card per skill: emoji, name, category badge, big % (progress ring), change vs period (▲/▼ pp), status badge (Active / Maintenance / Dormant), "recovering" badge when below peak, last practiced, current milestone text, mini sparkline. Click → detail page. Quick "Log" button on the card.
6. **Monthly check-in banner** and **backup reminder** (if last export > 14 days).

### 10.3 Skill Detail (`/skills/:id`)
- Header: emoji, name, category, status badge, Edit / Archive / Delete.
- Stat row: **Current %**, **Previous month %**, **Change (pp)**, **Peak %**, "Recovering" indicator.
- Practice stats (this month): sessions, total time (e.g. "8h 30m"), last practiced, average session points, number of performances.
- **Milestones**: Current, Next, progress bar, full editable list.
- **History chart** (line/area): skill % over time with range selector (1M, 3M, 6M, 1Y, All). Overlays: dashed **peak line**, shaded decay periods, dots for sessions, star markers for performances, vertical markers for manual adjustments and season start/end.
- **Plan / Season card**: goal, dates, cadence, adherence, pace, projected level at target, verdict; actions: *Start season*, *End season* (outcome note → dormant/maintenance + revisit date).
- **Session log list**: date, minutes, notes, performance badge, points, growth (+pp); edit/delete; "Log session" button.
- **Adjustments list**: manual adjustments with reason, shown separately from growth.
- **Manual adjust**: "Set level to…" (percent + reason + "also lower my peak") → `manual_adjustment` event, labelled as such everywhere.
- **Config panel**: base growth, grace, half-life, recovery boost etc. (changes create a `config_changed` event).

### 10.4 Add / Edit Skill modal
Fields: name, emoji, category (combobox with existing + suggestions), template, starting level %, base growth (with GrowthPreview + alternative "expected gain per month" input), grace period (days), **half-life** (days; shows equivalent k and converter from "% per day"), optional milestones (editor, "Use template suggestions", "Draft with AI"), optional **Season**: goal, target date, sessions/week, end condition, revisit date. Validation with inline errors.

### 10.5 Export page (`/export`) — Notion copy-paste
Controls: date range (default last 30 days), skills multi-select, toggles (include AI feedback, include level changes, include decay notes, include manual adjustments / status changes).

Output tabs, each with **Copy** button and **Download**:
1. **Markdown (paste into Notion)** — grouped by date, newest first:
```
## 2026-10-03 (Sat)
### 🎸 Guitar — 45 min · Performed: Recorded video
**What I did:** …notes…
**Session points:** 72/100 (difficulty 60 · novelty 40 · focus 75)
**AI feedback:** summary… Next: suggestion…
**Skill level:** 23.5% → 24.1% (peak 25.0%) · +0.6 pp
---
```
   Also lines for manual adjustments ("Adjusted Marathi 5% → 4%: reason"), status/season changes, and optional "Decay began" notes.
2. **CSV (Notion database import)** — columns: Date, Skill, Category, Minutes, Performed, Performance Type, Audience, Notes, Points, Level Before, Level After, Change (pp).
3. **Weekly summary markdown** — per skill per week: sessions, minutes, start→end level.
4. **Full JSON backup** — download; **Import JSON** (validate with zod; choose *Replace* or *Merge*; show a preview of counts first).

Update `settings.lastExportAt` on any export/download.

### 10.6 Settings
Theme, API key (password field + show toggle + test button), AI model, AI on/off, change threshold, default config values, archived skills list (restore), **Load demo history** (generates ~12 months of synthetic events flagged in UI as demo), **Reset all data** (type-to-confirm).

### 10.7 First run
Seed the sample skills dated **today** (so there is no fake history): Guitar 5%, Knitting 2%, Gym 40%, Java 55%, Coding & Problem Solving 45%, Interview 20%, Marathi 3%, with sensible templates/categories (Creative: Guitar, Knitting; Physical: Gym; Technical: Java, Coding; Communication: Interview, Marathi). Include sample Marathi milestones (0/5/10/20/30/50/70/90/100). Show a dismissible banner: "This is demo data — edit anything, or load demo history to see how charts evolve."

---

## 11. Visual Design

- Feels like a **personal development command center**: calm, spacious, data-forward.
- Fonts: Inter (body), Space Grotesk (headings/big numbers); tabular numerals for percentages.
- Dark by default if system prefers dark; light mode supported; toggle in top bar. Use CSS variables:
  - `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--muted`, `--accent` (violet→cyan gradient), `--success`, `--warning`, `--danger`.
- Category colors: Physical `#f97316`, Technical `#3b82f6`, Creative `#ec4899`, Communication `#10b981`, Other `#94a3b8` (used for dots/badges, not for the radar fill).
- Cards: rounded-2xl, soft borders, subtle shadow, hover lift.
- Animations: radar value tweening, card mount stagger, progress ring fill; disable under `prefers-reduced-motion`.
- Responsive: ≥1024px two-column (radar left, summary/cards right); mobile single column, radar full width (min height ~340px), sticky bottom nav.
- Accessibility: all chart data also available as an accessible table (`<details>` "View as table"); keyboard-focusable radar labels; sufficient contrast; labels on all inputs.

---

## 12. Persistence

- `StorageAdapter { load(): Promise<AppData|null>; save(data: AppData): Promise<void> }`.
- `LocalStorageAdapter` uses a single key `skill-progress-tracker:v1`, saves debounced (300 ms), validates with zod on load, runs `migrations.ts` by `schemaVersion`.
- If load fails validation: do **not** wipe data. Show an error screen with "Download raw data" and "Reset" options.
- Store actions: `addSkill`, `updateSkill`, `deleteSkill` (deletes events too, with confirm + suggestion to export), `archiveSkill`, `logSession`, `updateSession`, `deleteEvent`, `adjustLevel`, `changeConfig`, `changeStatus`, `startSeason`, `endSeason`, `importData`, `resetData`, `loadDemoHistory`.
- Derived data (timelines, snapshots, stats) lives in selectors, **never** in persisted state.

---

## 13. Testing & Acceptance Criteria

### Unit tests (Vitest, `domain/engine/__tests__`)
1. **Growth:** level 0.20, baseGrowth 0.01, units 1, no recovery → +0.008 → **0.208**. Level 0.80 → +0.002 → **0.802**.
2. **Diminishing returns:** same session at 20% gives exactly 4× the growth of at 80%.
3. **Decay with grace:** level 0.20, halfLife 180, grace 7: inactive 1, 3 and 7 days → unchanged (0.20); inactive 37 days (30 effective) → **≈ 0.17818** (0.2 × 2^(−30/180)); day 8 is the first decay day.
4. **Daily steps equal closed form:** simulating N inactive days equals `level0 * exp(-k * effectiveDays)` within 1e-9.
5. **Never below 0 / above 1.**
6. **Recovery:** peak 0.25, level 0.23, recoveryBoost 2, baseGrowth 0.01, units 1 → multiplier 1.16 → level **≈ 0.238932**; continued practice pushes level above the old peak and updates `peak`.
7. **Units:** 45 min, points 50, no performance → 1.5; points 100 → qualityFactor 1.75; points 0 → 0.25; daily cap respected.
8. **Performance:** recorded vs live-with-100-people gives larger units; audience bonus tiers.
9. **Manual adjustment:** 5% → 4% appears as an adjustment event, not growth; `lowerPeakToo` lowers peak; `lastPracticeDate` unchanged.
10. **Status multipliers:** dormant decays slower than active with identical inputs.
11. **Replay determinism:** same events → identical timeline; editing/deleting a past event changes all later levels; config change at a date affects only later days.
12. **Snapshots:** `levelAt` before skill creation → `null`; period snapshot dates match the table in 6.5.
13. **Milestones:** current/next at boundaries (exactly 5%, below 5%, above max).
14. **Fallback score & zod parsing** of AI JSON (valid, invalid, extra text → retry path).
15. **Export:** Markdown for a sample day matches snapshot; CSV escapes commas/quotes/newlines; JSON round-trip import equals original.

### Manual acceptance checklist
- [ ] Add / edit / delete skill works; data survives refresh.
- [ ] Logging a 30-min session changes the level by a small, diminishing amount and updates the radar immediately.
- [ ] A performed session scores/grows noticeably more than the same session unperformed.
- [ ] Stopping practice for >grace days visibly decays the skill in the history chart; returning shows "Recovering" and faster regrowth.
- [ ] Period selector shows correct overlays; "Current" shows one shape; no "All Time".
- [ ] Clicking a radar label opens the skill page.
- [ ] Manual adjustment is recorded as an adjustment (marker on chart + list).
- [ ] Ending a season moves the skill to dormant, hides it from the radar by default, and keeps its history.
- [ ] Export page copies Markdown that pastes cleanly into Notion; CSV imports into a Notion database; JSON import/export round-trips.
- [ ] AI scoring works with a valid key; falls back gracefully with none or on error.
- [ ] Works on a 375px-wide screen and in light/dark mode.

### Edge cases to handle
Skill created mid-period; sessions on past dates (recompute); no sessions at all; many sessions same day (cap); future dates blocked; DST (use date-only strings); AI returns malformed JSON; API key missing/invalid/rate-limited; localStorage full or unavailable; importing a file from a newer schemaVersion; deleting a skill with history; two tabs open (use the `storage` event to reload).

---

## 14. Build Phases (copy-paste prompts for Copilot)

> Prefix every prompt with: **"Read SPEC.md. Follow `.github/copilot-instructions.md`. Only implement what this phase asks."**

**Phase 0 — Scaffold.** Create the Vite + React + TS (strict) project, add Tailwind v4, react-router-dom, zustand, recharts, zod, date-fns, framer-motion, lucide-react, vitest + testing-library. Create the folder structure from section 3 with empty/placeholder files, theme tokens in `index.css`, and an app shell with routes and a theme toggle.

**Phase 1 — Domain types & engine.** Implement `domain/types.ts`, `defaults.ts`, and everything in `domain/engine/` per section 6, plus all unit tests in section 13 (items 1–13). Do not touch UI. All tests must pass.

**Phase 2 — Templates.** Implement `domain/templates/builtin.ts` per section 8 with all eight templates.

**Phase 3 — Storage & store.** Implement `storage/*` (zod schemas, migrations, debounced adapter) and `store/useAppStore.ts` + `selectors.ts` (memoized timelines). Include first-run seed data and `loadDemoHistory` generator (section 10.7, 10.6). Add tests for storage load/save/migration.

**Phase 4 — Dashboard.** Build PeriodSelector, RadarPanel (multi-series, clickable custom labels, fallback for <3 skills, accessible table), SummaryStrip, SkillCardGrid per section 10.2. Responsive and animated.

**Phase 5 — Skill form.** Add/Edit modal with MilestoneEditor, half-life converter, GrowthPreview and the "expected gain per month" calibration helper (section 6.4), season section. Validate inputs.

**Phase 6 — Session logging.** LogSessionModal with template fields, performance input, self-rating, save options; fallback scoring; AiScorePanel (without live AI yet); edit/delete sessions.

**Phase 7 — Skill detail page.** All sections in 10.3: stats, milestones, history chart with peak line/decay shading/markers, session list, adjustments, manual adjust, config panel, plan card with `planProgress.ts`.

**Phase 8 — AI.** Implement `domain/ai/*` (client, prompts, schema, scoreSession with retry and fallback), Settings API key UI with test button, wire into session logging; then monthly check-in and optional milestone drafting. Mock `fetch` in tests.

**Phase 9 — Export.** ExportPage with Markdown/CSV/weekly summary/JSON (section 10.5) and tests (item 15). Backup reminder banner.

**Phase 10 — Polish.** Accessibility pass, empty states, error boundaries, toasts, keyboard shortcuts (`L` = log session), performance check, README with setup/usage.

---

## 15. `.github/copilot-instructions.md` (copy this block)

```md
# Project rules for Copilot

- Project: Skill Progress Tracker. Source of truth is /SPEC.md. Read it before generating code.
- This is NOT a habit tracker. Never add streaks, daily-check-in nagging, or "completed today" logic.
- TypeScript strict. No `any`. Prefer small pure functions.
- `src/domain/**` must stay pure (no React, no localStorage, no zustand). All math lives there.
- Skill level is a fraction 0..1 internally; show percent in the UI.
- Never store derived values (timelines, snapshots) in persisted state. Persist events only; recompute.
- Dates are 'YYYY-MM-DD' strings (local day). Use date-fns calendar-day helpers.
- Growth: growth = baseGrowth * units * (1 - level) * recoveryMultiplier.
- Decay: after graceDays, daily level *= exp(-k * statusMultiplier), k = ln2 / halfLifeDays. Level in [0,1].
- Any change to engine behavior requires updating/adding Vitest tests first.
- Validate all external data (localStorage, imports, AI JSON) with zod.
- Use Tailwind + CSS variables from styles/index.css; support light/dark and mobile (375px).
- Keep components small; put feature code under src/features/<feature>/.
- Do not add a backend or new dependencies without asking.
```

---

## 16. Out of Scope (for now)

Backend/database, accounts/auth, multi-user, notifications/reminders, mobile native app, gamification (badges/streaks), social sharing. The `StorageAdapter` interface is the seam for adding a backend later.
