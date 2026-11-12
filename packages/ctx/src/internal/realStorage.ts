import type { KeyValueStorage } from "../KeyValueStorage.ts";

/** What to do when the runtime has no `localStorage`. */
const UNAVAILABLE =
  "ctx.storage: this runtime has no localStorage; run node with --experimental-webstorage --localstorage-file=<path>, or pass createCtx({ storage })";

/** Platform localStorage, resolved at call time; rejects where the runtime has none (k.ctx). */
export function realStorage(): KeyValueStorage {
  const store = (): Storage => {
    if (typeof localStorage === "undefined") throw new Error(UNAVAILABLE);
    return localStorage;
  };
  return {
    get: async (key) => store().getItem(key),
    set: async (key, value) => {
      store().setItem(key, value);
    },
  };
}
