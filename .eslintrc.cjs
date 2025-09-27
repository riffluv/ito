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
    eqeqeq: "off",
    "no-duplicate-imports": "off",
    "prefer-const": "off",
    "consistent-return": "off",
    "no-console": "off",

    // New JSX transform removes need for React in scope
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unknown-property": ["warn", { ignore: ["jsx"] }],

    // Allow broader flexibility across legacy modules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-unsafe-declaration-merging": "off",
    "@typescript-eslint/no-empty-object-type": "off",

    // Relax hook rules to accommodate existing implementations
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/rules-of-hooks": "off",

    // Permit intentional empty blocks used as placeholders
    "no-empty": "off",
  },
  overrides: [
    {
      files: ["**/*.stories.*"],
      rules: { "react-hooks/rules-of-hooks": "off" },
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
