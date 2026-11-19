import type { Net } from "@keel/ctx";
import type { KeyValueStorage } from "@keel/ctx";
import { capacitorNet } from "./internal/capacitorNet.ts";
import { preferencesStorage } from "./internal/preferencesStorage.ts";

/**
 * The `storage` and `net` drivers of a Capacitor shell (std.shells), which a shell build's generated entry passes to
 * `createCtx({ mode: 'shell', drivers })` (k.shell). `origin` is the build's `KEEL_ORIGIN`: requests on the page's
 * own origin go there.
 */
export function capacitorDrivers(opts: { readonly origin: URL }): {
  readonly storage: KeyValueStorage;
  readonly net: Net;
} {
  return { storage: preferencesStorage(), net: capacitorNet(opts.origin) };
}
