# NoteFlow - Offline-first Notes & Tasks

NoteFlow is a portfolio-grade offline-first notes and tasks app. The UI writes to IndexedDB first, then syncs to an Express/Postgres backend when the network is available. The project focuses on readable architecture, testable sync logic, PWA installability, and conflict handling that avoids silent data loss.

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

Install dependencies:

```bash
npm install
```

Create `server/.env` from `server/.env.example`:

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
npm run server
```

Start the frontend:

```bash
npm run dev
```

If the backend is not on `http://localhost:4000`, set a root `.env` for Vite:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## Scripts

```bash
npm run build
npm run test:run
npm run preview
npm run server:migrate
npm run server
```

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
npm run test:run
```
