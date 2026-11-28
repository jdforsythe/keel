import { clientStdPackages } from "./clientStdPackages.ts";

/**
 * Declare `pkg`'s `std` config client-readable (k.module Std config, rfc:0069). A stdlib package whose code reads its
 * config in the browser calls it once at import, beside `s.register(pkg, Config)`. Only such packages' config, and
 * only for the modules of the deployable being served, reaches an island document's `#k-state` or a `client` entry;
 * by default a package's config stays on the server, and `stdConfig` in the browser gives `{}` for it.
 * With `keys`, only those top-level keys of each module's config reach the browser (rfc:0070). Calls for one package
 * merge: keyed calls add to the key list (union), and a repeat keyless call is a no-op. Mixing the two shapes throws
 * (red-team 0217): a keyless call after a keyed one would otherwise widen to the whole config and send server-only
 * keys to the browser, so the import that does it fails (E1159 under `importDeps`).
 */
export function clientStd(pkg: string, keys?: readonly string[]): void {
  const had = clientStdPackages.has(pkg);
  const known = clientStdPackages.get(pkg);
  if (had && (known === undefined) !== (keys === undefined))
    throw new Error(`clientStd ${pkg} declared both with and without keys; declare one shape`);
  clientStdPackages.set(pkg, keys === undefined ? undefined : [...new Set([...(known ?? []), ...keys])]);
}
