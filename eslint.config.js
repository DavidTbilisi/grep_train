import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.browser },
  },
  {
    files: ["sw.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: globals.serviceworker },
  },
  {
    files: ["tests/**/*.mjs", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.node },
  },
  {
    ignores: ["grep_practice/**", "node_modules/**"],
  },
];
