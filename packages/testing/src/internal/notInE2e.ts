import { fail } from "./fail.ts";

/**
 * E1736 (k.e2e Rules): a harness call (`render`, `renderRoute`, `resumeDocument`, `simulate`) in an end-to-end run,
 * where the built app in a browser is what is under test.
 */
export function notInE2e(call: string): void {
  if (typeof process !== "undefined" && process.env.KEEL_E2E === "1")
    throw fail("E1736", `${call} is a harness call; an e2e test drives the built app: serve() from @keel/testing/e2e`, {
      call,
    });
}
