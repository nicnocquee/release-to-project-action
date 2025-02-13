import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["**/dist/**", "**/scripts/**", "**/*.test.ts", "**/__tests__/**"],
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...tseslint.configs.recommended[0].rules
    }
  }
];
