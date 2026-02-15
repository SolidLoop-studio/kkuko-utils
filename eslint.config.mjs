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
];

export default eslintConfig;