import type { Net } from "@keel/ctx";
import type { KeyValueStorage } from "@keel/ctx";
import { storeStorage } from "./internal/storeStorage.ts";
import { tauriNet } from "./internal/tauriNet.ts";

/**
 * The `storage` and `net` drivers of a Tauri shell (std.shells), which a shell build's generated entry passes to
 * `createCtx({ mode: 'shell', drivers })` (k.shell). `origin` is the build's `KEEL_ORIGIN`: requests on the page's
 * own origin go there, through the http permission the generated capability grants for that origin only.
 */
export function tauriDrivers(opts: { readonly origin: URL }): {
  readonly storage: KeyValueStorage;
  readonly net: Net;
} {
  return { storage: storeStorage(), net: tauriNet(opts.origin) };
}
