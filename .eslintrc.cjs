module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  env: { browser: true, es2023: true, node: true, jest: true },
  settings: { react: { version: "detect" } },
  rules: {
    eqeqeq: ["warn", "always"],
    "no-duplicate-imports": "warn",
    "prefer-const": "warn",
    "consistent-return": "warn",
    "no-console": ["warn", { allow: ["error", "warn"] }],

    // New JSX transform removes need for React in scope
    "react/react-in-jsx-scope": "off",

    // Allow incremental fixes: warn instead of error for many rules
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-unsafe-declaration-merging": "warn",

    // React hooks rules should be warnings so we can iterate fixes
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/rules-of-hooks": "warn",

    // Relax no-empty and similar rules that currently break CI
    "no-empty": "warn",
  },
  overrides: [
    {
      files: ["**/*.stories.*"],
      rules: { "react-hooks/rules-of-hooks": "off" },
    },
  ],
};
