import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Architectural boundary: Admin code must not import client-side auth or components
  {
    files: ["src/features/admin/**/*.{ts,tsx}", "src/routes/admin.*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/yatra-auth",
                "**/yatra-auth",
                "@/components/SiteHeader",
                "@/components/Dashboard*",
                "@/components/AddPassengerDialog*",
              ],
              message: "Admin code must not import client-side auth or components to preserve modular independence.",
            },
          ],
        },
      ],
    },
  },
  // Architectural boundary: Client code must not depend on admin feature code
  {
    files: [
      "src/components/*.{ts,tsx}",
      "src/lib/yatra-*.{ts,tsx}",
      "src/routes/auth.tsx",
      "src/routes/book.*.tsx",
      "src/routes/dashboard.tsx",
      "src/routes/index.tsx",
      "src/routes/personal-details.tsx",
      "src/routes/select-yatra.tsx",
      "src/routes/transactions.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/admin/*", "**/features/admin/*"],
              message: "Client code must not depend on Admin feature code.",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
