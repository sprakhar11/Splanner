# Splanner

A local-first interview prep and daily planning web app. SQLite database, no cloud, no accounts — your data stays on your machine.

## Features

- **Planner** — monthly calendar with an agenda timeline, task creation with deadlines, reminders, priorities, and repeating tasks
- **Focus Timer** — stopwatch or countdown timer with a floating always-on-top clock (Document Picture-in-Picture), pause/resume, and automatic time logging
- **Interview Prep** — unified tracker for DSA, System Design, LLD, or any custom topic. Add items to a spaced-repetition revision queue
- **Stats** — streaks, daily/monthly progress per topic against configurable targets, focus time charts, heatmap, and an interview readiness score
- **Journal** — quick notes with type tagging (concept, mistake, general), favourites, and optional revision scheduling
- **Revise** — spaced-repetition cards with AGAIN/HARD/GOOD/EASY grading (intervals: 0, 1, 3, 7, 14, 30, 90 days)
- **Reflection** — end-of-day review with mood tracking, auto-prefilled metrics from your tracked activity
- **Settings** — goals, notification preferences, appearance (dark/light/system), category management, interview topic targets, data export/import
- **Command Palette** — `Cmd+K` / `Ctrl+K` for instant search across everything (powered by FTS5)
- **Notifications** — in-app toasts + optional OS notifications for reminders, overdue tasks, and reflection nudges

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Motion (Framer Motion), TanStack Query, React Router
- **Backend:** Hono (lightweight Node.js framework), better-sqlite3, Drizzle ORM
- **Database:** SQLite with WAL mode, FTS5 full-text search, 21 triggers for index sync
- **Local only:** server binds to `127.0.0.1`, no external network calls

## Running Locally

### Prerequisites

- Node.js 20+ (tested on 26.x)
- pnpm 9+ (`npm install -g pnpm` if not installed)

### Setup

```bash
# Clone
git clone https://github.com/sprakhar11/Splanner.git
cd Splanner

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

This starts:
- Vite dev server on `http://localhost:5173` (or 5174 if 5173 is busy)
- Hono API server on `http://127.0.0.1:3001`

Open `http://localhost:5173` in your browser. The database is created automatically on first run at `data/splanner.db`.

### Production Build

```bash
pnpm build
```

Outputs a static bundle to `dist/`. Serve it with any static file server alongside the API.

## Project Structure

```
src/
├── client/                 # React frontend
│   ├── api/                # API client
│   ├── components/         # UI components
│   ├── hooks/              # React hooks (timer, settings, reminders, etc.)
│   ├── lib/                # Pure logic (date math, readiness score, streaks)
│   ├── pages/              # Route pages
│   └── styles/             # Tailwind globals
├── server/                 # Hono backend
│   ├── db/                 # Schema, connection, migrations, seed
│   ├── routes/             # API endpoints
│   └── services/           # Business logic (SRS, recurrence, backup)
data/                       # SQLite database (git-ignored)
drizzle/                    # SQL migrations
scripts/                    # Verification and seed scripts
```

## Data

All data lives in `data/splanner.db`. The server creates a daily snapshot backup to `data/backups/` on startup.

You can export/import JSON backups from Settings → Your Data.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `C` | Create new task (in planner) |
| `T` | Jump to today (in planner) |
| `←` / `→` | Navigate days (in planner) |
| `Esc` | Close modals/palette |
| `/` | Open command palette (when not in an input) |

## License

Private / personal use.
