# Skill Progress Tracker

A browser-based tracker for building durable skills. Log practice, estimate capability growth and retention, review progress over time, and export or back up your history.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```sh
npm install
npm run dev
```

Vite prints the local development URL after startup.

## Available commands

```sh
npm run build       # Type-check and create the production bundle in dist/
npm run preview     # Preview the production bundle locally
npm run test:run    # Run the test suite once
npm run test        # Run Vitest in watch mode
npm run lint        # Run ESLint
```

## Using the app

- Add a skill from the header and choose a template, starting level, growth and retention settings, milestones, or an optional season plan.
- Open a skill card for its history, sessions, milestones, configuration, and manual adjustments.
- Log a session from the header, a skill card, or a skill detail page. The `L` key opens the session form when focus is not in a text field or dialog.
- Compare skill levels over time on the dashboard. Use the table view when you need chart values in an accessible tabular format.
- Configure optional AI scoring in Settings. Without AI, sessions can still be saved or fallback-scored.
- Export Markdown, CSV, weekly summaries, or a JSON backup from Export. JSON backups can be validated and restored or merged.

## Data and privacy

The app is frontend-only. Skills, sessions, and settings are stored in this browser's localStorage; they are not synchronized to a server. Export JSON backups regularly if you want to preserve or move your data.

AI scoring is optional. When enabled with an API key, the browser sends the session details directly to Anthropic. The key is stored in this browser's localStorage. Do not enable AI on a shared or untrusted device.

## Technology

React, TypeScript, Vite, Tailwind CSS v4, Zustand, React Router, Recharts, Zod, date-fns, Framer Motion, and Vitest.
