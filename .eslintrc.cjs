module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
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
    eqeqeq: ["error", "always"],
    "no-duplicate-imports": "error",
    "prefer-const": "error",
    "consistent-return": "error",
    "no-console": ["warn", { allow: ["error", "warn"] }],
  },
  overrides: [
    {
      files: ["**/*.stories.*"],
      rules: { "react-hooks/rules-of-hooks": "off" },
    },
  ],
};
