import type { Net } from "@keel/ctx";
import type { KeyValueStorage } from "@keel/ctx";
import { capacitorNet } from "./internal/capacitorNet.ts";
import { preferencesStorage } from "./internal/preferencesStorage.ts";

/**
 * The `storage` and `net` drivers of a Capacitor shell (std.shells), which a shell build's generated entry passes to
 * `createCtx({ mode: 'shell', drivers })` (k.shell). `origin` is the build's `KEEL_ORIGIN`: requests on the page's
 * own origin go there. `connect` holds the other exact origins `net` sends to (k.shell Origins; none when absent);
 * a request or redirect hop to any other URL is refused.
 */
export function capacitorDrivers(opts: { readonly origin: URL; readonly connect?: readonly string[] }): {
  readonly storage: KeyValueStorage;
  readonly net: Net;
} {
  return { storage: preferencesStorage(), net: capacitorNet(opts.origin, opts.connect) };
}
