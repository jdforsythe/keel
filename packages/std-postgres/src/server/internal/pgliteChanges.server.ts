import type { Changes } from "./Changes.ts";
import { localChanges } from "./localChanges.server.ts";

/** Shared by every evaluation of this module in the process, as the engines are: one per `pglite:` URL. */
const KEY = Symbol.for("keel.postgres.pgliteChanges");

function shared(): Map<string, Changes> {
  const found: unknown = Reflect.get(globalThis, KEY);
  if (found instanceof Map) return found;
  const made = new Map<string, Changes>();
  Reflect.set(globalThis, KEY, made);
  return made;
}

const byUrl = shared();

/** Changes on a `pglite:` folder: the one in-process database delivers to its own follows. */
export function pgliteChanges(url: string): Changes {
  const hit = byUrl.get(url);
  if (hit !== undefined) return hit;
  const made = localChanges();
  byUrl.set(url, made);
  return made;
}
