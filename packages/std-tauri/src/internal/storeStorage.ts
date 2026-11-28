import type { KeyValueStorage } from "@keel/ctx";
import { load } from "@tauri-apps/plugin-store";
import { cellStorage } from "./cellStorage.ts";
import { checksum } from "./checksum.ts";

interface Store {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  length(): Promise<number>;
  reload(options?: { ignoreDefaults?: boolean }): Promise<void>;
  save(): Promise<void>;
}

/** One whole copy of the store: its generation and every key. */
interface Copy {
  readonly gen: number;
  readonly data: ReadonlyMap<string, string>;
}

/** The two files and the copy the driver holds, with the file it was read from. */
interface Held {
  readonly main: Store;
  readonly backup: Store;
  copy: Copy & { readonly from: string };
}

/** The files; a load prefers `keel.json` on equal generations. */
const MAIN = "keel.json";
const BACKUP = "keel.b.json";
/** The one plugin-store key each file holds: `{ gen, sum, data }`. */
const KEY = "keel";

const messageOf = (e: unknown): string => (typeof e === "string" ? e : e instanceof Error ? e.message : "");

/** The copy a document holds, or undefined when it is not a whole copy (cut, edited, or another shape). */
function copyOf(doc: unknown): Copy | undefined {
  if (typeof doc !== "object" || doc === null) return undefined;
  const gen: unknown = Reflect.get(doc, "gen");
  const sum: unknown = Reflect.get(doc, "sum");
  const text: unknown = Reflect.get(doc, "data");
  if (typeof gen !== "number" || !Number.isSafeInteger(gen) || gen < 1) return undefined;
  if (typeof text !== "string" || sum !== checksum(`${gen}:${text}`)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const data = new Map<string, string>();
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== "string") return undefined;
    data.set(k, v);
  }
  return { gen, data };
}

/** A file as the plugin reads it from disk: missing, present but not a whole copy, or a whole copy. */
async function readFile(store: Store, file: string): Promise<"absent" | "damaged" | Copy> {
  try {
    await store.reload({ ignoreDefaults: true });
  } catch (e) {
    const m = messageOf(e);
    if (m.startsWith("Failed to deserialize store")) return "damaged";
    if (m.includes("(os error 2)") || m.includes("(os error 3)")) return "absent";
    throw new Error(`ctx.storage: ${file} cannot be read`);
  }
  if ((await store.length()) === 0) return "absent";
  return copyOf(await store.get(KEY)) ?? "damaged";
}

/**
 * The newer whole copy and the file it came from (`keel.json` on equal generations). With none: a fresh install, or a
 * crash inside the first save (only `keel.b.json` exists), is the empty store; anything else is damage no crash
 * leaves, so it rejects and nothing is overwritten.
 */
function choose(main: "absent" | "damaged" | Copy, backup: "absent" | "damaged" | Copy): Held["copy"] {
  if (typeof main !== "string" && (typeof backup === "string" || main.gen >= backup.gen))
    return { ...main, from: MAIN };
  if (typeof backup !== "string") return { ...backup, from: BACKUP };
  if (main === "absent") return { gen: 0, data: new Map(), from: MAIN };
  throw new Error(`ctx.storage: ${MAIN} and ${BACKUP} hold no whole copy of the store; delete both to start empty`);
}

/**
 * k.persist's storage on `@tauri-apps/plugin-store`, crash-safe over plugin-store's `save` (which truncates its file
 * before writing it): `keel.json` and `keel.b.json` in the app's data directory each hold one whole copy, a generation
 * and a checksum. A write saves the next copy first to the file the driver did not read its copy from (`keel.b.json`
 * when both are whole), then to the other, before it resolves, so a crash at any point leaves one whole copy of the
 * earlier or the new state, and a load takes the newer whole copy. A file that
 * cannot be parsed is never read as empty. A failed write rejects with the plugin's error and the next call loads
 * again from the files. A failed load, or files holding no whole copy, rejects that call and is tried again on the next.
 */
export function storeStorage(
  open: (file: string) => Promise<Store> = (file) => load(file, { autoSave: false, defaults: {} }),
): KeyValueStorage {
  let held: Promise<Held> | undefined;
  const opened = async (): Promise<Held> => {
    const main = await open(MAIN);
    const backup = await open(BACKUP);
    return { main, backup, copy: choose(await readFile(main, MAIN), await readFile(backup, BACKUP)) };
  };
  const state = (): Promise<Held> => {
    held ??= opened().catch((e: unknown) => {
      held = undefined;
      throw e;
    });
    return held;
  };
  return cellStorage({
    get: async (key) => (await state()).copy.data.get(key) ?? null,
    put: async (entries) => {
      const s = await state();
      const data = new Map(s.copy.data);
      for (const [key, value] of entries) data.set(key, value);
      const gen = s.copy.gen + 1;
      const text = JSON.stringify(Object.fromEntries(data));
      const doc = { gen, sum: checksum(`${gen}:${text}`), data: text };
      try {
        for (const store of s.copy.from === BACKUP ? [s.main, s.backup] : [s.backup, s.main]) {
          await store.set(KEY, doc);
          await store.save();
        }
      } catch (e) {
        held = undefined;
        throw e;
      }
      s.copy = { gen, data, from: MAIN };
    },
  });
}
