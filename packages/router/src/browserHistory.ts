import type { RouterHistory } from "./types/RouterHistory.ts";

/**
 * The `RouterHistory` over `window.history` for the generated browser entry. Each entry's state holds its key,
 * prefixed by this page load's nonce so an entry made before a reload pops without a key. Scroll restoration is
 * manual: the router saves and restores positions per entry key itself.
 */
export function browserHistory(): RouterHistory {
  const current = (): string => `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const load = `${window.crypto.randomUUID()}:`;
  const keyOf = (state: unknown): string | undefined => {
    const k = typeof state === "object" && state !== null && "keel" in state ? state.keel : undefined;
    return typeof k === "string" && k.startsWith(load) ? k.slice(load.length) : undefined;
  };
  window.history.scrollRestoration = "manual";
  return {
    push: (url, key) => window.history.pushState({ keel: `${load}${key}` }, "", url),
    replace: (url, key) => window.history.replaceState({ keel: `${load}${key}` }, "", url),
    current,
    onPop: (fn) => {
      const listener = (e: PopStateEvent): void => fn(current(), keyOf(e.state));
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
  };
}
