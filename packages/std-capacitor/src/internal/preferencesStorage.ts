import { Preferences } from "@capacitor/preferences";
import type { StorageDriver } from "./StorageDriver.ts";
import { cellStorage } from "./cellStorage.ts";

/** k.persist's storage on `@capacitor/preferences` (SharedPreferences on Android, UserDefaults on iOS), kept across app restarts. */
export function preferencesStorage(): StorageDriver {
  return cellStorage({
    get: async (key) => (await Preferences.get({ key })).value,
    put: async (entries) => {
      for (const [key, value] of entries) await Preferences.set({ key, value });
    },
  });
}
