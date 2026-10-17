# rellyjims

Workout tracker for two (or more) with splits, swappable exercise options, and built-in progressive overload.

**Stack:** Next.js 16 (App Router, Cache Components) · Prisma 7 + Neon Postgres · Better Auth (username + PIN) · Tailwind v4 · Vercel

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Neon:** create a project, then copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: the **pooled** connection string (host has `-pooler`)
   - `DIRECT_URL`: the **direct** string (used by migrations)
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000`
3. **Create tables**
   ```bash
   npm run db:migrate -- --name init
   ```
4. **First admin** (sign-up is disabled, so this is the only way in)
   ```bash
   npm run create-admin -- martin 1234 "Martin"
   ```
5. **Run:** `npm run dev`, then sign in at http://localhost:3000/login. Create other accounts from `/admin`.

## Deploy (Vercel)

Import the repo, add the same four env vars (`BETTER_AUTH_URL` = your `https://…vercel.app` URL), and deploy. The build runs `prisma generate`. Run migrations against production with `npm run db:deploy` (with `.env` pointing at the prod `DIRECT_URL`).

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `test` | Vitest unit tests (progression engine, notes importer) |
| `typecheck` / `lint` | tsc / ESLint |
| `db:migrate` / `db:deploy` / `db:studio` | Prisma |
| `create-admin` | Bootstrap an admin account |

## How it fits together

```
prisma/schema.prisma        Auth tables + Exercise, Split → SplitDay → ExerciseGroup → ExerciseSlot,
                            SlotProgress, SplitShare, WorkoutSession → SessionExercise
src/lib/auth.ts             Better Auth: username plugin, PIN as password, admin plugin,
                            DB-backed rate limit, 5-strike / 15-min per-account lockout
src/lib/progression.ts      Double-progression engine + presets (pure, tested)
src/lib/import-notes.ts     Parses the plain-text notes format into days/groups/slots (tested)
src/proxy.ts                Redirects signed-out visitors to /login (Next 16's middleware)
src/app/login               Username + PIN keypad
src/app/(app)/admin         Create accounts, reset PINs, remove users
src/app/(app)/…             Home (favorites first) + stubs for the remaining screens
```

### Concepts

- **Group:** a numbered set of interchangeable options ("3: Lever Row / Landmine Row / Seated Cable Row"). Pick any of them; nothing is enforced.
- **Slot:** one option in a group, with its own **tracking mode** (`PROGRESSIVE` or `MANUAL`) and **rulebook**: `targetSets`, `repFloor`, `repCeiling`, `repStep`, `weightStep`, plus deload settings.
- **Outcomes:** *Failed* (enter what you actually did, which becomes the new baseline), *Hold* (same target next time), *Graduate* (+`repStep` reps; at the ceiling, ±`weightStep` and reps reset to the floor). Assisted exercises move the weight *down*; bodyweight adds a set.
- **Deload:** after `deloadAfterFails` consecutive fails, the engine suggests dropping about `deloadPercent`.
- **Sharing:** splits are personal. Sharing sends the structure only; the recipient's copy arrives with an empty rulebook and no progress.

## Next up

- [x] Split editor + presets UI (`/splits/[splitId]`, `/splits/[splitId]/days/[dayId]/edit`)
- [x] Notes importer UI (`/splits/[splitId]/import`)
- [x] Day picker → "Rellyjim" (creates a `WorkoutSession`)
- [x] Swipeable workout screen with Failed / Hold / Graduate
- [x] End-of-workout report with ▲ ● ▼ markers
- [ ] History, sharing inbox, PWA icons
