# AGENTS.md

This file provides instructions for coding agents working in this repository.

## Project Overview

This project is a web application that provides various utilities, information lookup tools, and practice features for the Korean word game [Kkutu Korea](https://kkutu.co.kr).

The project is named **Kkuko Utils (`kkuko-utils`)**.

Main features include:

- Word combiner
- Word list management tools (e.g. duplicate removal, file merging)
- Word list sharing and an open database
- Kkutu Korea profiles and rankings using an unofficial API
- Mini-games for improving Kkutu Korea skills, such as word and typing practice
- Miscellaneous features such as useful programs and replay analysis

## Project Structure

- `src/`: Source code
- `src/__tests__/`: Test code
- `src/app/`: Web application source code
- `public/`: Static files used by the web application
- `docs/`: Documentation used for web development, such as external API specifications and naming conventions
- `.github/`, `scripts/`: GitHub-related files and scripts used in deployment and other workflows

## Commands

```bash
npm run dev            # Start dev server with Turbopack
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Run all Jest tests
npm run test:watch     # Jest in watch mode
npm run test:coverage  # Coverage report
npm run gen-type       # Regenerate Supabase TypeScript types from remote schema
```

Run a single test file:

```bash
npx jest src/__tests__/mini-game/game/lib/GameLogic.test.ts
```

## Architecture

This site is a utility application for the Korean word-chain game **Kkutu Korea**, built with **Next.js 15 using the App Router**. It is deployed on Vercel and uses Supabase for its database and authentication backend.

### Main Feature Areas

| Route                    | Purpose |
| ------------------------ | ------- |
| `/word-combiner`         | Provides a greedy word-combination tool. Users enter the character fragments they own, and the page generates words that can be created from them for Kkutu Korea's word-combination reward system. |
| `/manager-tool/arrange`  | Provides tools for organizing word lists (`.txt` files) that can be used in Kkutu Korea, such as sorting and duplicate removal. |
| `/manager-tool/extract/*` | Provides pages for extracting specific words from Kkutu Korea word lists (`.txt`), such as words ending with a certain character or words of a specific length. |
| `/words-docs`            | Allows users to browse groups of words based on the open database. Subpages provide access to individual word collections. |
| `/word/*`                | Provides access to the administrator-managed open database and its data. Subpages provide features such as word search and word downloads. |
| `/kkuko/profile`         | Allows users to look up Kkutu Korea user profiles. |
| `/kkuko/ranking`         | Displays custom rankings based on Kkutu Korea user data, such as wins in specific modes or level rankings. |
| `/mini-game`             | Allows users to practice words or typing using word lists uploaded by the user. |
| `/programs`              | Displays useful Kkutu Korea-related programs registered by administrators. Subpages provide detailed information about individual programs. |
| `/replay-analyzer`       | Provides tools for analyzing downloaded game replays to identify new words, mistakes, and other useful information. |
| `/profile/*`             | Displays information about Kkuko Utils users. |
| `/release-note`          | Displays manually created and automatically generated GitHub release notes. |
| `/notification`          | Displays Kkuko Utils announcements and notices. |
| `/terms`, `/privacy`     | Displays the service terms and privacy policy. |
| `/admin`                 | Provides an administrator dashboard for managing the open database, announcements, and other administrative features. Additional functionality is available through subpages. |

### State Management

- **Redux Toolkit** — Global application state (`src/app/store/`) and mini-game state (`src/app/mini-game/game/store/`). The mini-game has its own Redux `Provider` in `src/app/mini-game/providers.tsx`.
- **React Query** (`@tanstack/react-query`) — Used for server-state fetching. The default `staleTime` is 1 minute.
- **SWR** — Also used in some components for data fetching.

### Mini-game Internals

The mini-game (`/mini-game`) runs entirely client-side:

- Words are loaded from an uploaded `.txt` file and stored in **IndexedDB** (`wordDB.ts`, powered by `idb`).
- `GameLogic.ts` — Pure static methods for turn logic, start-character selection, and word validation.
- `GameManager.ts` — Stateful orchestrator that drives the game loop.
- `useGameLogic.ts` / `useGameState.ts` — Hooks that connect React components to the game managers.
- `SoundManager.ts` — Wraps Howler.js for audio.
- The Redux slice (`gameSlice.ts`) contains only `isPlaying`, `pendingStart`, and `startBlocked`. **Do not place game logic in Redux.**

### Supabase Type Generation

`src/app/types/database.types.ts` is auto-generated.

Edit the schema in Supabase first, then run:

```bash
npm run gen-type
```

to synchronize the generated TypeScript types.

Do not manually edit this file.

### Auth Flow

Authentication uses Google OAuth through Supabase.

- `src/app/AutoLogin.tsx` restores sessions when the application mounts.
- The OAuth callback is handled by `src/app/api/auth/callback/route.ts`.

## Domain Terminology

- `kkuko` refers to **Kkutu Korea** and is the primary name used throughout the codebase for core game logic, data, and features related to the Kkutu Korea word-chain game. It appears in function names, variable names, and component names directly related to the game.

- `docs`: Refers to a word collection used to group multiple words according to specific criteria for browsing or management. Do not confuse this meaning with the `docs/` directory, where `docs` has the conventional meaning of "documentation."

- `k_canuse`: A column in the `words` table indicating whether a word can be used under general rules such as 끝말잇기 (word-chain), 앞말잇기 (reverse word-chain), and 쿵쿵따. For Korean verbs and adjectives, this value is usually `false`.

- `noin_canuse`: A column in the `words` table indicating whether a word can be used in Kkutu Korea when the special **어인정** rule is disabled.

## Development Rules

- Preserve the existing code style.
- Do not perform unnecessary refactoring.
- Do not modify files outside the requested scope.
- When adding a new feature, add tests whenever reasonably possible.
- When creating a separate worktree, symlink the existing `node_modules` only if the lockfile is unchanged, remove only the symlink before deleting the worktree, and use `npm ci` if dependencies differ.

## Rules for Code Implementation

### Required

- Follow the existing React + Next.js project structure.
- Prefer Tailwind CSS for styling.
- Do not arbitrarily change the behavior of existing public APIs.
- Do not use `alert` or `confirm`.
- Use the project's Modal component for errors or messages that must be shown to users.
- After completing code changes, run ESLint and a TypeScript type check.

### Preferred

- Prefer reusing existing shadcn/ui components when implementing UI.
- Prefer `lucide-react` for icons.
- Separate UI, state management, and business logic appropriately.
- Add Korean JSDoc comments to complex or publicly reusable major functions and components.
- Avoid using `any`.
- For external inputs or other values with unknown types, use `unknown` instead of `any` and perform type narrowing.
- If `any` or an ESLint disable directive is unavoidable, keep its scope as narrow as possible.

## Naming Conventions (`docs/NAMING_CONVENTIONS.md`)

- **Variables/functions**: Use camelCase. Boolean names should use an `is`, `has`, or `can` prefix.
- **Components**: Use PascalCase. The file name must match the component name (e.g. `UserCard.tsx`).
- **Hooks**: Must start with `use`.
- **Files/folders**: Use kebab-case, except for component files, which use PascalCase.
- **Types/interfaces**: Use PascalCase. Do not use an `I` prefix for interfaces.
- **DB query functions (SCM)**: Use `<table>By<Param>` for single-record lookups and `all<Table>` for fetching all records.
- Prefer full words over abbreviations.

## Testing

Tests are located in `src/__tests__/` and mirror the structure of `src/app/`.

The setup file (`jest.setup.ts`) mocks:

- `ResizeObserver`
- `IntersectionObserver`
- `matchMedia`
- `URL.createObjectURL`

Use `@testing-library/react` and `@testing-library/user-event` for component tests.

## Verification

After making code changes, run the following verification commands as appropriate for the scope of the change:

```bash
npm run lint
npx tsc --noEmit
npm run test
```

- If running the full test suite is expensive, prioritize tests related to the modified functionality.
- If the change affects the build process or configuration, also run:

```bash
npm run build
```

- If a test failure appears to be caused by a pre-existing issue, do not modify the test arbitrarily. Report the failure instead.
- If any verification command could not be executed, explicitly state which command was not run and why.

## Commit Convention

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are enforced by commitlint (`commitlint.config.js`).

Husky runs the commit message check through the `commit-msg` hook.

Use the following commit types:

- `feat`
- `fix`
- `chore`
- `docs`
- `refactor`
- `test`
- `ci`

## Handling Ambiguity

- Ask the user when different interpretations of a requirement would meaningfully change the feature behavior, data structure, API, or UI/UX.
- For implementation details that can be reasonably determined from existing code, documentation, tests, or project conventions, follow the existing patterns.
- If a requirement conflicts with the existing implementation, do not arbitrarily change the current behavior. Ask the user for confirmation.