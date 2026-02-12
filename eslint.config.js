import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist", "node_modules"],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
         "react-hooks/purity": "off",


      // Keep your original rule:
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],

      // Vite/React refresh rule sometimes blocks prototypes:
      "react-refresh/only-export-components": "off",

      // This is the one yelling in your terminal:
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
