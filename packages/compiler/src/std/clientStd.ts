import { clientStdPackages } from "./clientStdPackages.ts";

/**
 * Declare `pkg`'s `std` config client-readable (k.module Std config, rfc:0069). A stdlib package whose code reads its
 * config in the browser calls it once at import, beside `s.register(pkg, Config)`. Only such packages' config, and
 * only for the modules of the deployable being served, reaches an island document's `#k-state` or a `client` entry;
 * by default a package's config stays on the server, and `stdConfig` in the browser gives `{}` for it.
 */
export function clientStd(pkg: string): void {
  clientStdPackages.add(pkg);
}
