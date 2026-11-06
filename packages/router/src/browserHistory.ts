import type { RouterHistory } from "./types/RouterHistory.ts";

/**
 * The `RouterHistory` over `window.history` for the generated browser entry. Scroll restoration is manual:
 * the router saves and restores positions itself.
 */
export function browserHistory(): RouterHistory {
  const current = (): string => `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.history.scrollRestoration = "manual";
  return {
    push: (url) => window.history.pushState(null, "", url),
    replace: (url) => window.history.replaceState(null, "", url),
    current,
    onPop: (fn) => {
      const listener = (): void => fn(current());
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
  };
}
