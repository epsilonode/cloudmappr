import js from "@eslint/js"
import functional from "eslint-plugin-functional"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["coverage/**", "node_modules/**", "proj-ledger/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      globals: { ...globals.es2024, Deno: "readonly" },
    },
    plugins: { functional },
    rules: {
      "functional/immutable-data": "error",
      "functional/no-let": "error",
      "functional/no-loop-statements": "error",
      "functional/no-this-expressions": "error",
      "functional/no-throw-statements": "error",
      "functional/no-try-statements": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    files: ["packages/**/*.test.ts"],
    rules: {
      "functional/no-throw-statements": "off",
      "functional/no-try-statements": "off",
    },
  },
)
