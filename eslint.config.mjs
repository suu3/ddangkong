import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "writable",
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": hooksPlugin,
      "@typescript-eslint": typescriptPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-unused-vars": "warn",
      "no-undef": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "no-unsafe-optional-chaining": "warn",
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      // These files contain protocol/Worker classes, not React class components.
      "react/no-is-mounted": "off",
      // TypeScript checks type names and Cloudflare runtime globals.
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    ignores: [
      ".next/**/*",
      ".netlify/**",
      "node_modules/**/*",
      "**/.wrangler/**",
      "test-results/**",
      "playwright-report/**",
      "public/**/*",
      "eslint.config.mjs",
    ],
  },
];
