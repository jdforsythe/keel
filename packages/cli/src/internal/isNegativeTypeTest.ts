/** A negative type test (k.unsafe): a `*.test-d.ts` or `*.test-d.tsx` file under a `test/` or `conformance/` folder. */
export function isNegativeTypeTest(path: string): boolean {
  return /\.test-d\.tsx?$/.test(path) && /(?:^|\/)(?:test|conformance)\//.test(path);
}
