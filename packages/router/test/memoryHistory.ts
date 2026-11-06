// Test-only in-memory RouterHistory with a pop hook.
import type { RouterHistory } from "../src/types/RouterHistory.ts";

export type TestHistory = RouterHistory & { entries: string[]; pop(url: string): void };

export function memoryHistory(start: string): TestHistory {
  const entries = [start];
  const subs: ((url: string) => void)[] = [];
  return {
    entries,
    push: (url) => {
      entries.push(url);
    },
    replace: (url) => {
      entries[entries.length - 1] = url;
    },
    current: () => entries[entries.length - 1] ?? start,
    onPop: (fn) => {
      subs.push(fn);
    },
    pop: (url) => {
      entries.push(url);
      for (const fn of subs) fn(url);
    },
  };
}
