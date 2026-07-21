# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all Jest tests
npm run test:watch   # Jest in watch mode
npm run test:coverage  # Coverage report
npm run gen-type     # Regenerate Supabase TypeScript types from remote schema
```

Run a single test file:
```bash
npx jest src/__tests__/mini-game/game/lib/GameLogic.test.ts
```

## Architecture

This is a Next.js 15 (App Router) utility site for the Korean word-chain game "끄투코리아". It is deployed on Vercel and uses Supabase as the database and auth backend.

### Main Feature Areas

| Route | Purpose |
|---|---|
| `/kkuko` | Player profile lookup and ranking viewer for the live game |
| `/mini-game` | Offline word-chain game simulator (끝말잇기) |
| `/manager-tool` | Word-list manipulation tools (extract by rule, arrange, merge) |
| `/admin` | Admin panel — word approval queue, user management, logs |

### Data Access Layer (two coexisting systems)

**Legacy: `SupabaseClientManager` (SCM)**
`src/app/lib/supabase/SupabaseClientManager.ts` — the current primary data access object. It exposes four sub-managers: `SCM.add()`, `SCM.get()`, `SCM.delete()`, `SCM.update()`. The singleton is exported from `src/app/lib/supabaseClient.ts` as `SCM` (browser) and created via `supabaseServer.ts` / `supabaseServerManager.ts` on the server.

**New: Domain service layer (Strangler Fig)**
`src/lib/services/` implements a clean Domain → Application → Infrastructure architecture that is gradually replacing the SCM. The entry point is `WordServiceContainer` (`src/lib/services/WordServiceContainer.ts`), which is assembled with `createWordServiceContainer(supabase)`. New word-related features should use `WordQueryService` / `WordCommandService` instead of SCM where possible.

### State Management

- **Redux Toolkit** — global app state (`src/app/store/`) and mini-game state (`src/app/mini-game/game/store/`). The mini-game has its own Redux `Provider` in `src/app/mini-game/providers.tsx`.
- **React Query** (`@tanstack/react-query`) — server-state fetching; default `staleTime` is 1 minute.
- **SWR** — also used in some components for data fetching.

### Mini-game internals

The mini-game (`/mini-game`) runs entirely client-side:
- Words are loaded from an uploaded `.txt` file and stored in **IndexedDB** (`wordDB.ts`, powered by `idb`).
- `GameLogic.ts` — pure static methods for turn logic, start-char selection, and word validation.
- `GameManager.ts` — stateful orchestrator that drives the game loop.
- `useGameLogic.ts` / `useGameState.ts` — hooks connecting React to the game managers.
- `SoundManager.ts` — wraps Howler.js for audio.
- Redux slice (`gameSlice.ts`) holds only `isPlaying`, `pendingStart`, and `startBlocked` — keep game logic out of Redux.

### Supabase type generation

`src/app/types/database.types.ts` is auto-generated. Edit the schema in Supabase, then run `npm run gen-type` to sync it. Do not manually edit that file.

### Auth flow

Authentication is Google OAuth via Supabase. `src/app/AutoLogin.tsx` restores sessions on mount. The OAuth callback is handled at `src/app/api/auth/callback/route.ts`.

## Testing

Tests live in `src/__tests__/`, mirroring the `src/app/` structure. The setup file (`jest.setup.ts`) mocks `ResizeObserver`, `IntersectionObserver`, `matchMedia`, and `URL.createObjectURL`. Use `@testing-library/react` and `@testing-library/user-event` for component tests.

## Naming Conventions (`docs/NAMING_CONVENTIONS.md`)

- **Variables/functions**: camelCase; booleans use `is`/`has`/`can` prefix.
- **Components**: PascalCase; file name matches component name (e.g., `UserCard.tsx`).
- **Hooks**: must start with `use`.
- **Files/folders**: kebab-case (except component files which are PascalCase).
- **Types/interfaces**: PascalCase; no `I` prefix on interfaces.
- **DB query functions (SCM)**: `<table>By<Param>` for single lookups; `all<Table>` for full fetches.
- Prefer full words over abbreviations.

## Commit Convention

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint (`commitlint.config.js`). Husky runs the check on `commit-msg`. Use types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

## Main variable name
- `kkuko` (끄투코리아) is the main variable name used throughout the codebase to refer to the core game logic, data, or features related to the 끄투코리아 word-chain game. It appears in function names, variable names, and component names that are directly related to the game's functionality.
- `docs` is a collection that allows you to group and view multiple words based on specific criteria. For example, you can create a `docs` collection that gathers words frequently used in games or words recently added to a database. This is called a vocabulary list.
- `k_canuse` is a column in the `words` table that stores whether the word can be used in general rules such as 끝말잇기, 앞말잇기, and 쿵쿵따. For Korean verbs and adjectives, it is usually false.
- `noin_canuse` is a word that can be used in 끄투코리아 without turning on the special rule "어인정".