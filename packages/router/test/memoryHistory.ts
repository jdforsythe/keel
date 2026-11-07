// Test-only in-memory RouterHistory with a pop hook. `entries` holds the URLs, `keys` the parallel entry keys.
import type { RouterHistory } from "../src/types/RouterHistory.ts";

export type TestHistory = RouterHistory & {
  entries: string[];
  keys: (string | undefined)[];
  pop(url: string, key?: string): void;
};

export function memoryHistory(start: string): TestHistory {
  const entries = [start];
  const keys: (string | undefined)[] = [undefined];
  const subs: ((url: string, key?: string) => void)[] = [];
  return {
    entries,
    keys,
    push: (url, key) => {
      entries.push(url);
      keys.push(key);
    },
    replace: (url, key) => {
      entries[entries.length - 1] = url;
      keys[keys.length - 1] = key;
    },
    current: () => entries[entries.length - 1] ?? start,
    onPop: (fn) => {
      subs.push(fn);
    },
    pop: (url, key) => {
      entries.push(url);
      keys.push(key);
      for (const fn of subs) fn(url, key);
    },
  };
}
