import type { Net } from "../Net.ts";
import { typeOfServiceBestEffort } from "./typeOfServiceBestEffort.ts";

/** `navigator.onLine` where a global `navigator` exists, else true. */
const read = (): boolean => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Platform fetch, resolved at call time (k.ctx), and the platform's connectivity: `changed` hears each change the
 * window's `online` and `offline` events bring. The two listeners end when `signal` aborts; with an aborted `signal`
 * none is added. A peer that resets the connection fails the request as a rejected fetch, on Node too
 * (`typeOfServiceBestEffort`).
 */
export function realNet(changed: (online: boolean) => void, signal: AbortSignal | undefined): Net {
  typeOfServiceBestEffort();
  const net: Net = { fetch: (req) => fetch(req), online: read };
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return net;
  if (signal?.aborted === true) return net;
  let last = read();
  const on = (): void => {
    const now = read();
    if (now === last) return;
    last = now;
    changed(now);
  };
  const options = signal === undefined ? {} : { signal };
  window.addEventListener("online", on, options);
  window.addEventListener("offline", on, options);
  return net;
}
