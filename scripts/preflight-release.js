#!/usr/bin/env node
/* eslint-disable no-console */
const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const allowMissing = args.has("--allow-missing");
const failOnError = strict && !allowMissing;

const requiredKeys = [
  "NEXT_PUBLIC_APP_VERSION",
  "NEXT_PUBLIC_ENABLE_PWA",
  "NEXT_PUBLIC_FEATURE_SAFE_UPDATE",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
];

const recommendedKeys = [
  "NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION",
  "NEXT_PUBLIC_SENTRY_DSN",
];

const adminKeyOptions = [
  "FIREBASE_ADMIN_KEY_JSON",
  "FIREBASE_ADMIN_KEY_BASE64",
  "FIREBASE_ADMIN_CREDENTIAL",
  "FIREBASE_ADMIN_KEY_PATH",
  "GOOGLE_APPLICATION_CREDENTIALS",
];

const truthy = (value) => typeof value === "string" && value.trim().length > 0;

const missing = requiredKeys.filter((key) => !truthy(process.env[key]));
const adminPresent = adminKeyOptions.some((key) => truthy(process.env[key]));
const missingAdmin = adminPresent ? [] : adminKeyOptions;

const errors = [];
const warnings = [];

if (missing.length > 0) {
  errors.push(`Missing required env keys: ${missing.join(", ")}`);
}

const recommendedMissing = recommendedKeys.filter((key) => !truthy(process.env[key]));
if (recommendedMissing.length > 0) {
  warnings.push(`Missing recommended env keys: ${recommendedMissing.join(", ")}`);
}

if (missingAdmin.length > 0) {
  errors.push(
    "Missing Firebase Admin credentials. Set one of: " +
      adminKeyOptions.join(", ")
  );
}

const pwaEnabled = process.env.NEXT_PUBLIC_ENABLE_PWA;
if (pwaEnabled && pwaEnabled !== "1") {
  warnings.push("NEXT_PUBLIC_ENABLE_PWA is not '1' (PWA disabled).");
}
const safeUpdateEnabled = process.env.NEXT_PUBLIC_FEATURE_SAFE_UPDATE;
if (safeUpdateEnabled && safeUpdateEnabled !== "1") {
  warnings.push("NEXT_PUBLIC_FEATURE_SAFE_UPDATE is not '1' (Safe Update disabled).");
}

const appVersionRaw = process.env.NEXT_PUBLIC_APP_VERSION;
if (truthy(appVersionRaw)) {
  const appVersion = String(appVersionRaw).trim().toLowerCase();
  if (["dev", "development", "local"].includes(appVersion)) {
    warnings.push(`NEXT_PUBLIC_APP_VERSION is '${appVersionRaw}' (consider setting a release tag).`);
  }
}

const emulatorFlag = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR;
if (emulatorFlag === "1" || emulatorFlag === "true") {
  errors.push("NEXT_PUBLIC_FIREBASE_USE_EMULATOR is enabled (should be off for production).");
}

const emulatorKeys = [
  "NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST",
  "NEXT_PUBLIC_AUTH_EMULATOR_HOST",
  "NEXT_PUBLIC_DATABASE_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_DATABASE_EMULATOR_HOST",
];
const emulatorSet = emulatorKeys.filter((key) => truthy(process.env[key]));
if (emulatorSet.length > 0) {
  warnings.push(`Emulator env detected: ${emulatorSet.join(", ")}`);
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("release preflight: OK");
  process.exit(0);
}

if (errors.length > 0) {
  console.error("release preflight: ERROR");
  errors.forEach((msg) => console.error(`- ${msg}`));
}
if (warnings.length > 0) {
  console.warn("release preflight: WARN");
  warnings.forEach((msg) => console.warn(`- ${msg}`));
}

if (errors.length > 0 && failOnError) {
  process.exit(1);
}
process.exit(0);
