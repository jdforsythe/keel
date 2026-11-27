import { STUB_NAME } from "./STUB_NAME.ts";
import { exportNames } from "./exportNames.ts";
import { stubCode } from "./stubCode.ts";

/**
 * The module a browser build loads in place of the server-only file `file` (k.boundary Browser builds, k.bundle Names):
 * `stubCode` over the file's value exports, so its code and imports never load; null when the file's name on disk
 * (`named`, which differs from `file` only in case) is not a JS or TS file, which a browser build cannot stub. `shown` is
 * the name the stub reports and `router` the `@keel/router/internal` it imports. The Vite plugin and the size tool
 * (`tooling/budgets.mjs`) both load a server-only file through this.
 */
export function browserStub(file: string, named: string, shown: string, router: string): string | null {
  return STUB_NAME.test(named) ? stubCode(shown, exportNames(file), router) : null;
}
