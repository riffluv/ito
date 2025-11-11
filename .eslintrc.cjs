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
    eqeqeq: "error",
    "no-duplicate-imports": "error",
    "prefer-const": "error",
    "consistent-return": "warn",
    // Allow warn/error logging in critical paths but flag stray debugging calls
    "no-console": ["warn", { allow: ["warn", "error"] }],

    // New JSX transform removes need for React in scope
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unknown-property": ["warn", { ignore: ["jsx"] }],

    // Encourage stricter typing but allow phased migration via warnings
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-unsafe-declaration-merging": "error",
    "@typescript-eslint/no-empty-object-type": "warn",

    // Hooks must follow the React rules; dependency drift is surfaced as warnings
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/rules-of-hooks": "error",

    // Allow intentionally empty catch blocks but flag other empty statements
    "no-empty": ["warn", { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: [
        "**/__tests__/**/*",
        "tests/**/*",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
      ],
      rules: {
        // Tests freely mock firebase/network contracts; allow any/complex hooks usage with inline comments when necessary.
        "@typescript-eslint/no-explicit-any": "off",
        "react-hooks/rules-of-hooks": "off",
        "react-hooks/exhaustive-deps": "off",
      },
    },
    {
      files: ["**/*.d.ts"],
      rules: {
        "@typescript-eslint/no-empty-object-type": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
};
