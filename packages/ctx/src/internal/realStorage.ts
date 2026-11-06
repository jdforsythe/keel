import type { KeyValueStorage } from "../KeyValueStorage.ts";

/** Platform localStorage, resolved at call time; rejects where the runtime has none (k.ctx). */
export function realStorage(): KeyValueStorage {
  const store = (): Storage => {
    if (typeof localStorage === "undefined")
      throw new Error("ctx.storage: localStorage is unavailable in this runtime");
    return localStorage;
  };
  return {
    get: async (key) => store().getItem(key),
    set: async (key, value) => {
      store().setItem(key, value);
    },
  };
}
