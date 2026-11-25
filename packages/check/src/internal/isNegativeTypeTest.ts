import { isTypeTestName } from "./isTypeTestName.ts";

/** A negative type test (k.unsafe): a `*.test-d.ts` or `*.test-d.tsx` file under a `test/` or `conformance/` folder. */
export function isNegativeTypeTest(path: string): boolean {
  return isTypeTestName(path) && /(?:^|\/)(?:test|conformance)\//.test(path);
}
