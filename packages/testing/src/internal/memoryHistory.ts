import type { RouterHistory } from "@keel/router";

/** In-memory `RouterHistory` starting at `start` (the router's own tests use the same pattern); never pops. */
export function memoryHistory(start: string): RouterHistory {
  const entries = [start];
  return {
    push: (url) => {
      entries.push(url);
    },
    replace: (url) => {
      entries[entries.length - 1] = url;
    },
    current: () => entries[entries.length - 1] ?? start,
    onPop: () => undefined,
  };
}
