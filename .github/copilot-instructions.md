# kkuko-utils - Korean Word Game Utilities

kkuko-utils is a Next.js web application providing utilities for Korean word games including word combination tools, dictionary management, open database word downloads, and typing practice features.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

- **Environment Requirements**:
  - Node.js v20+ (validated with v20.19.4)
  - npm 10+ (validated with 10.8.2)

- **Bootstrap and Dependencies**:
  - `npm install` -- **CRITICAL**: Network connectivity issues may occur with external CDN dependencies:
    - `xlsx` package uses https://cdn.sheetjs.com which may be blocked in CI environments
    - If install fails, temporarily modify package.json to use `"xlsx": "^0.18.5"` instead of the CDN URL
    - Takes ~30 seconds when successful
  - **REQUIRED**: Create `.env.local` with minimal Supabase configuration:
    ```
    NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
    NEXT_PUBLIC_SUPABASE_ANON_KEY=test_key
    SUPABASE_SERVICE_KEY=test_service_key
    ```

- **Build Process**:
  - `npm run build` -- **FAILS in network-restricted environments due to Google Fonts**
    - Error: "Failed to fetch `Geist` from Google Fonts" from fonts.googleapis.com
    - Build cannot complete without network access to external font CDNs
    - Takes ~15 seconds to fail when network restricted
    - **DO NOT** attempt builds in environments without Google Fonts access

- **Testing**:
  - `npm test` -- takes ~21 seconds. NEVER CANCEL. Set timeout to 60+ minutes.
  - `npm run test:coverage` -- generates coverage reports
  - `npm run test:watch` -- for development
  - **85 tests pass successfully** covering manager-tool extract functionality
  - Tests work reliably without network dependencies

- **Development Server**:
  - `npm run dev` -- starts Next.js with Turbopack on http://localhost:3000
  - Takes ~2 seconds to start
  - Works with minimal environment variables
  - **ALWAYS** create `.env.local` first before starting dev server

- **Code Quality**:
  - `npm run lint` -- takes ~3 seconds. ESLint passes with no warnings.
  - **ALWAYS** run linting before committing changes or CI will fail

- **Rules for Code Implementation (Mandatory)**
  - Use **React + Next.js** for coding. Use **Tailwind CSS** for styling; direct styles should only be used when unavoidable.
  - For **Dark Mode**, use Tailwind's `dark:` prefix. In most cases, rely on the default `dark:` settings unless special styling is required.
  - Adhere to the **SoC (Separation of Concerns)** principle.
  - Actively utilize **shadcn** and **lucide-react** for design to ensure a consistent UI/UX.
  - After writing code, perform **lint checks** and **type checks** using `tsc --noEmit`.
  - Avoid using `unknown` or `any` types whenever possible.
  - Use **PascalCase** for component filenames. However, use **kebab-case** for router/path names.
  - Write **JSDoc comments** for major functions and components.
  - For **error handling**, do not just use `console.error`. Use `ErrModal` to notify the user. (Exception: For errors like 4xx, use `FailModal.tsx` to notify them of the failure.)
  - **Do not use** native `alert` or `confirm`. Instead, use custom React components such as `CompleteModal.tsx` and `ConfirmModal.tsx`.

## Validation

- **ALWAYS** manually test any changes by running the development server and exercising the affected functionality
- **Key user scenarios to test**:
  - Word extraction tools at `/manager-tool/extract/`
  - English mission word extractor
  - Korean mission word tools 
  - File merge functionality
  - Word combination features
- **ALWAYS** run `npm test && npm run lint` before completing changes
- You cannot build the application in network-restricted environments - focus on tests and dev server validation

## Network Connectivity Issues

This repository has specific network dependencies that fail in restricted environments:
- **Google Fonts** (fonts.googleapis.com) - required for build process
- **xlsx CDN** (cdn.sheetjs.com) - required for npm install
- **Workaround for testing**: Use npm version of xlsx (`^0.18.5`) and skip build validation

## Common Tasks

The following are key commands and their expected behavior:

### Repository Structure
```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── manager-tool/      # Word management utilities  
│   ├── word/              # Word-related features
│   ├── word-combiner/     # Word combination tools
│   └── layout.tsx         # Root layout with Google Fonts
├── __tests__/             # Jest test files
├── docs/                  # Documentation including naming conventions
├── supabase/              # Supabase configuration
└── .github/workflows/     # CI/CD configuration
```

### Package.json Scripts
```json
{
  "dev": "next dev --turbopack",     // Development server
  "build": "next build",             // Production build (requires network)
  "start": "next start",             // Production server
  "lint": "next lint",               // ESLint checking
  "test": "jest",                    // Run test suite
  "test:coverage": "jest --coverage" // Coverage reports
}
```

### Configuration Files
- `jest.config.ts` - Jest testing configuration with jsdom environment
- `eslint.config.mjs` - ESLint configuration excluding test files
- `next.config.ts` - Next.js configuration with lucide-react transpilation
- `supabase/config.toml` - Local Supabase development configuration
- `tsconfig.json` - TypeScript configuration with @/* path mapping

### Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test_key
SUPABASE_SERVICE_KEY=test_service_key
```

## Important Locations

- **Primary features**: `/app/manager-tool/` - Word extraction and management tools
- **Tests**: `/__tests__/manager-tool/extract/` - Comprehensive test coverage for core features  
- **API routes**: `/app/api/` - Backend API endpoints
- **Types**: `/app/types/database.types.ts` - Supabase database type definitions
- **Components**: `/app/components/` - Reusable UI components
- **Documentation**: `/docs/NAMING_CONVENTIONS.md` - Project coding standards

## Key Features

1. **Word Extraction Tools** (`/manager-tool/extract/`):
   - English mission word extractor
   - Korean mission word tools
   - File merging utilities
   - Loop and pattern extraction

2. **Word Management** (`/word/`):
   - Word search functionality  
   - Dictionary downloads
   - Word requests and logs

3. **Word Combination** (`/word-combiner/`):
   - 6 and 5 letter word combinations
   - Game optimization tools

4. **Database Integration**:
   - Supabase backend with PostgreSQL
   - Real-time features
   - Authentication system
