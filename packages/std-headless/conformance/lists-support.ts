// Shared helpers for the std.lists conformance (not a test file). Public API only. Seed: 1337.
// Assumed: `listChart(id, part, options, ctx?)` is called inside a scope (the calling component's); its members `list`, `index`, `open`, `activeId` and `rows` are `Computed`s read with `.get()`; the queries and events are plain functions;
// `opened(at)` takes an index into `list` (none active when `at` is -1 or past the end; nothing on an open list); `activeOption()` returns the option or undefined; `stableRows(...)` returns a computed read with `.get()`.
import { scope } from "@keel/reactive";
import { afterEach } from "vitest";
import { simCtx } from "./fixtures.ts";

export { SEED, simCtx } from "./fixtures.ts";

const live = new Set<{ dispose: () => void }>();
const disposeLive = (): void => {
  for (const sc of live) sc.dispose();
  live.clear();
};
afterEach(disposeLive);

/** Runs `fn` in a scope. Scopes made by earlier calls are disposed first (a run's store id is free again), the new one at the end of the test; a throw in `fn` disposes it at once. */
export const inScope = <T>(fn: () => T): { value: T; dispose: () => void } => {
  disposeLive();
  const slot: T[] = [];
  const sc = scope(() => {
    slot.push(fn());
  });
  live.add(sc);
  const [value] = slot;
  if (value === undefined) {
    disposeLive();
    throw new Error("fixture: scope produced no value");
  }
  return { value, dispose: () => sc.dispose() };
};

export const fruit = [
  { key: "apple", text: "Apple" },
  { key: "banana", text: "Banana" },
  { key: "beet", text: "Beet" },
  { key: "bacon", text: "Bacon" },
  { key: "cherry", text: "Cherry" },
] as const;

export const sim = simCtx;
