# NoteFlow - Offline-first Notes & Tasks

NoteFlow is a portfolio-grade offline-first notes and tasks app. The UI writes to IndexedDB first, then syncs to an Express/Postgres backend when the network is available. The project focuses on readable architecture, testable sync logic, PWA installability, and conflict handling that avoids silent data loss.

Live demo: pending production URL.

## Screenshots

![Main workspace](docs/screenshots/main.png)

![Dark mode](docs/screenshots/dark-mode.png)

![Conflict resolver](docs/screenshots/conflict-resolver.png)

## Highlights

- React + Vite + TypeScript
- Tailwind CSS v4
- Dexie/IndexedDB as the client source of truth
- Zustand for UI-only state
- PWA installability with Workbox app-shell precache
- Express + Postgres sync API
- Dirty-flag based push and timestamp cursor pull
- Optimistic concurrency control for note conflicts
- Conflict resolver with 3 choices: keep local, keep server, merge manually
- Vitest coverage for repositories, sync engine, backend API, and conflict UI

## Repository Layout

```text
NoteFlow/
|-- front-end/ # React/Vite PWA
|-- backend/   # Express/Postgres API
|-- docs/     # screenshots and project docs
`-- package.json
```

The repo uses npm workspaces. `front-end/package.json` owns frontend dependencies, `backend/package.json` owns backend dependencies, and the root `package.json` only orchestrates common scripts.

## Architecture

```mermaid
flowchart LR
  UI[React UI] --> Zustand[Zustand UI state]
  UI --> Dexie[(Dexie / IndexedDB)]
  Dexie --> Sync[Client sync engine]
  Sync --> API[Express sync API]
  API --> Postgres[(Postgres)]
  API --> Sync
  Sync --> Dexie
```

Dexie is the source of truth for notes and tasks. Components never call the server directly. They write to local repositories first, then the sync engine pushes dirty records and pulls remote changes.

## Conflict Resolution

NoteFlow uses optimistic concurrency control for notes.

Each local note stores `baseVersion`, the server `updatedAt` value the client last knew before editing. During push, the server compares `baseVersion` with its current `updated_at`.

- If they match, no one else changed the note. The write is accepted.
- If they differ, another device or tab changed the note first. The server returns a conflict instead of overwriting.
- The client stores the conflict in IndexedDB and asks the user to keep local, keep server, or merge manually.

Tasks intentionally use a simpler strategy. If either side marks a task complete, `completed=true` wins; other task fields use the newest timestamp. This is a deliberate tradeoff because tasks are usually lower risk than long-form notes.

## Local Setup

Install all workspaces from the repo root:

```bash
npm install
```

Create `backend/.env` from `backend/.env.example`:

```env
DATABASE_URL=postgres://postgres:123456@localhost:5433/noteflow
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
```

`DATABASE_URL` points to Postgres. `PORT` is the Express API port.

Create the database in Postgres if needed:

```bash
createdb -U postgres -p 5433 noteflow
```

Run migrations:

```bash
npm run server:migrate
```

Start the backend:

```bash
npm run dev:server
```

Start the frontend:

```bash
npm run dev
```

If the backend is not on `http://localhost:4000`, set `front-end/.env` for Vite:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## Scripts

```bash
npm run dev
npm run dev:server
npm run dev:all
npm run build
npm test
npm run preview
npm run server:migrate
```

Workspace-specific commands:

```bash
npm run build --workspace=front-end
npm run test:run --workspace=front-end
npm test --workspace=backend
```

For deployment, set the frontend root directory to `front-end/` and the backend root directory to `backend/`.

## Production Deploy

Neon:

1. Create a Neon Postgres project.
2. Copy the connection string with `sslmode=require`.
3. Temporarily put that value in `backend/.env` as `DATABASE_URL`.
4. Run `npm run server:migrate`.
5. Remove the production secret from local `.env` after migration.

Render:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variables:
  - `DATABASE_URL`: Neon connection string with `sslmode=require`
  - `FRONTEND_ORIGIN`: production Vercel URL
  - `PORT`: leave unset unless Render requires otherwise; Render injects it automatically

Vercel:

- Root Directory: `front-end`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL`: production Render backend URL

## Accessibility And PWA

Latest Lighthouse Accessibility score: **100**.

The app includes keyboard-visible focus styles, a dialog-style conflict resolver with Escape close and focus trap, `aria-live` sync status updates, and reduced-motion handling for sync animation.

The PWA caches the app shell so the app can reopen offline. Data sync still depends on the sync engine and backend availability.

## Known Limits

- Background Sync API is not supported on Safari/iOS. NoteFlow falls back to app load, online events, and a 30-second sync interval.
- Conflict UI is full-featured for notes only. Tasks use the simpler strategy described above.
- There is no authentication yet; the backend is single-user for portfolio clarity.
- Deployment is planned for step 8.

## Testing

Automated tests cover:

- Dexie repositories
- Backend push/pull API
- Sync engine merge behavior
- Offline push skip
- Tombstone deletion
- Conflict storage
- Conflict resolver choices

Run:

```bash
npm test
```
