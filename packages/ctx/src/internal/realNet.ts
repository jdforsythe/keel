import type { Net } from "../Net.ts";

/** `navigator.onLine` where a global `navigator` exists, else true. */
const read = (): boolean => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Platform fetch, resolved at call time (k.ctx), and the platform's connectivity: `changed` hears each change the
 * window's `online` and `offline` events bring.
 */
export function realNet(changed: (online: boolean) => void): Net {
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    let last = read();
    const on = (): void => {
      const now = read();
      if (now === last) return;
      last = now;
      changed(now);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
  }
  return { fetch: (req) => fetch(req), online: read };
}
