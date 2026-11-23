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
