import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 1️⃣ [중요] 전역 무시 설정: 이 객체에는 'ignores' 외에 아무것도 넣지 마세요.
  {
    ignores: [
      "**/node_modules/",
      ".next/",
      "public/",
      "dist/",
      "supabase/",
      "test/",
      "**/*.test.tsx",
      "**/*.test.ts",
      "**/__tests__/**", // 폴더 통째로 무시하려면 이 패턴 추가
      "jest.config.ts",
      "jest.setup.ts",
    ],
  },

  // 2️⃣ 기존 Next.js 설정 확장
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  }),

  // 3️⃣ 모든 파일에 적용할 공통 규칙
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"], // 적용 대상을 명시적으로 지정
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}", "src/modules/*/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message: "Domain and application layers must not import the Supabase SDK.",
            },
            {
              group: ["react", "react/*"],
              message: "Domain and application layers must not import React.",
            },
            {
              group: ["next", "next/*"],
              message: "Domain and application layers must not import Next.js.",
            },
            {
              group: [
                "@/src/app/types/database.types",
                "@/src/app/types/database.types.ts",
                "@/src/app/types/database.types.tsx",
                "@/src/app/types/database.types/index",
                "@/src/app/types/database.types/index.ts",
                "@/src/app/types/database.types/index.tsx",
                "**/app/types/database.types",
                "**/app/types/database.types.ts",
                "**/app/types/database.types.tsx",
                "**/app/types/database.types/index",
                "**/app/types/database.types/index.ts",
                "**/app/types/database.types/index.tsx",
              ],
              message: "Domain and application layers must not import generated database types.",
            },
            {
              group: ["@/src/shared/infrastructure/*"],
              message: "Domain and application layers must not import shared infrastructure.",
            },
            {
              group: ["@/src/modules/*/infrastructure/*", "**/infrastructure/**"],
              message: "Domain and application layers must not import Infrastructure modules.",
            },
            {
              group: [
                "@/src/app/lib/supabaseClient",
                "@/src/app/lib/supabaseClient.ts",
                "@/src/app/lib/supabaseClient.tsx",
                "@/src/app/lib/supabaseClient/index",
                "@/src/app/lib/supabaseClient/index.ts",
                "@/src/app/lib/supabaseClient/index.tsx",
                "**/app/lib/supabaseClient",
                "**/app/lib/supabaseClient.ts",
                "**/app/lib/supabaseClient.tsx",
                "**/app/lib/supabaseClient/index",
                "**/app/lib/supabaseClient/index.ts",
                "**/app/lib/supabaseClient/index.tsx",
                "@/src/app/lib/supabase/*",
                "**/app/lib/supabase/*",
              ],
              message: "Domain and application layers must not import legacy Supabase aliases or managers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/presentation/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    ignores: [
      "src/app/lib/**",
      "src/app/types/**",
      "src/app/api/auth/callback/route.ts",
      "src/app/api/auth/set_nickname/route.ts",
      "src/app/api/auth/update_nickname/route.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message: "Presentation code must not import the Supabase SDK.",
            },
            {
              group: [
                "@/src/app/types/database.types",
                "@/src/app/types/database.types.ts",
                "@/src/app/types/database.types.tsx",
                "@/src/app/types/database.types/index",
                "@/src/app/types/database.types/index.ts",
                "@/src/app/types/database.types/index.tsx",
                "**/app/types/database.types",
                "**/app/types/database.types.ts",
                "**/app/types/database.types.tsx",
                "**/app/types/database.types/index",
                "**/app/types/database.types/index.ts",
                "**/app/types/database.types/index.tsx",
              ],
              message: "Presentation code must not import generated database types.",
            },
            {
              group: [
                "@/src/shared/infrastructure/supabase",
                "@/src/shared/infrastructure/supabase.ts",
                "@/src/shared/infrastructure/supabase.tsx",
                "@/src/shared/infrastructure/supabase/index",
                "@/src/shared/infrastructure/supabase/index.ts",
                "@/src/shared/infrastructure/supabase/index.tsx",
                "@/src/shared/infrastructure/supabase/*",
                "**/shared/infrastructure/supabase",
                "**/shared/infrastructure/supabase.ts",
                "**/shared/infrastructure/supabase.tsx",
                "**/shared/infrastructure/supabase/index",
                "**/shared/infrastructure/supabase/index.ts",
                "**/shared/infrastructure/supabase/index.tsx",
                "**/shared/infrastructure/supabase/*",
              ],
              message: "Presentation code must not import shared Supabase clients or Infrastructure.",
            },
            {
              group: [
                "@/src/app/lib/supabaseClient",
                "@/src/app/lib/supabaseClient.ts",
                "@/src/app/lib/supabaseClient.tsx",
                "@/src/app/lib/supabaseClient/index",
                "@/src/app/lib/supabaseClient/index.ts",
                "@/src/app/lib/supabaseClient/index.tsx",
                "**/app/lib/supabaseClient",
                "**/app/lib/supabaseClient.ts",
                "**/app/lib/supabaseClient.tsx",
                "**/app/lib/supabaseClient/index",
                "**/app/lib/supabaseClient/index.ts",
                "**/app/lib/supabaseClient/index.tsx",
                "@/src/app/lib/supabase/*",
                "**/app/lib/supabase/*",
              ],
              message: "Presentation code must not import legacy Supabase aliases or managers.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
