/** A file named `*.test-d.ts` or `*.test-d.tsx`, wherever it sits (k.unsafe). */
export function isTypeTestName(path: string): boolean {
  return /\.test-d\.tsx?$/.test(path);
}
