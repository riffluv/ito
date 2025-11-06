import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { app, firebaseEnabled } from "@/lib/firebase/client";

type ModuleState = {
  instance: Functions | null;
};

const state: ModuleState = {
  instance: null,
};

function init(): Functions | null {
  if (!firebaseEnabled || !app) return null;
  if (state.instance) return state.instance;
  const region =
    process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION &&
    process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION.trim().length > 0
      ? process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION.trim()
      : undefined;
  const instance = region ? getFunctions(app, region) : getFunctions(app);
  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true") {
    const host = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST || "localhost";
    const port = Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001);
    connectFunctionsEmulator(instance, host, port);
  }
  state.instance = instance;
  return state.instance;
}

export const functions: Functions | null = init();
