import type { Net } from "../Net.ts";

/** `navigator.onLine` where a global `navigator` exists, else true. */
const read = (): boolean => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Platform fetch, resolved at call time (k.ctx), and the platform's connectivity: `changed` hears each change the
 * window's `online` and `offline` events bring. `dispose` removes the two listeners, once; a repeat does nothing.
 */
export function realNet(changed: (online: boolean) => void): { readonly net: Net; readonly dispose: () => void } {
  const net: Net = { fetch: (req) => fetch(req), online: read };
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return { net, dispose: () => {} };
  const win = window;
  let last = read();
  const on = (): void => {
    const now = read();
    if (now === last) return;
    last = now;
    changed(now);
  };
  win.addEventListener("online", on);
  win.addEventListener("offline", on);
  let attached = true;
  const dispose = (): void => {
    if (!attached) return;
    attached = false;
    win.removeEventListener("online", on);
    win.removeEventListener("offline", on);
  };
  return { net, dispose };
}
