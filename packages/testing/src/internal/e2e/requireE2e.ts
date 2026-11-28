import { e2eError } from "./e2eError.ts";

/** E1736 (k.e2e Rules): `@keel/testing/e2e` is called only under `keel test --e2e`, which sets `KEEL_E2E=1`. */
export function requireE2e(call: string): void {
  if (process.env.KEEL_E2E !== "1")
    throw e2eError("E1736", `${call} runs only under keel test --e2e; move the test to test/**/*.e2e.ts`, { call });
}
