import { Preferences } from "@capacitor/preferences";
import type { KeyValueStorage } from "@keel/ctx";
import { cellStorage } from "./cellStorage.ts";

type Prefs = Pick<typeof Preferences, "get" | "set">;

/** The stored document: `[key, value]` pairs. Anything else rejects with a message that names no key or value. */
function parse(text: string | null): Map<string, string> {
  try {
    const v: unknown = JSON.parse(text ?? "[]");
    if (Array.isArray(v) && v.every((e) => Array.isArray(e) && e.length === 2 && e.every((s) => typeof s === "string")))
      return new Map(v);
  } catch {}
  throw new Error("stored state is unreadable");
}

/**
 * k.persist's storage on `@capacitor/preferences` (SharedPreferences on Android, UserDefaults on iOS), kept across app
 * restarts. Every key lives in the one entry `keel`, a JSON document read once and cached (one page owns the store), so
 * a write is one `Preferences.set`: it stores the whole next document or, when it rejects, the cache stays as it was.
 */
export function preferencesStorage(prefs: Prefs = Preferences): KeyValueStorage {
  let doc: Promise<Map<string, string>> | undefined;
  const open = (): Promise<Map<string, string>> => {
    doc ??= prefs.get({ key: "keel" }).then(
      (r) => parse(r.value),
      (e: unknown) => {
        doc = undefined;
        throw e;
      },
    );
    return doc;
  };
  return cellStorage({
    get: async (key) => (await open()).get(key) ?? null,
    put: async (entries) => {
      const next = new Map([...(await open()), ...entries]);
      await prefs.set({ key: "keel", value: JSON.stringify([...next]) });
      doc = Promise.resolve(next);
    },
  });
}
