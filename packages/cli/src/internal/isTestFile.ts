import { TEST_FILE } from "./TEST_FILE.ts";

/** An end-to-end test file anywhere in the tree: a `.e2e.ts` file under a `test/` folder (k.e2e Files). */
const E2E = /(?:^|\/)test\/(?:.+\/)?[^/]+\.e2e\.ts$/;

/**
 * A test file the ledger reads (k.ledger-items Run evidence): `.test.` or `.spec.` before a script extension, or an
 * end-to-end test file.
 */
export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path) || E2E.test(path);
}
