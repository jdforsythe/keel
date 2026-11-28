import type { RouterHistory } from "@keel/router";

/** In-memory `RouterHistory` starting at `start`, with `length()` its entry count; never pops. */
export function memoryHistory(start: string): RouterHistory & { length(): number } {
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
    length: () => entries.length,
  };
}
