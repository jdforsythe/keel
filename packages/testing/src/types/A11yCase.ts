/**
 * One finished test as a vitest reporter sees it, the input of `writeA11yReport`: file relative to the project root,
 * full name, whether it passed, and its `testCase.meta()`, where the harness keeps the test's render checks.
 */
export interface A11yCase {
  readonly file: string;
  readonly test: string;
  readonly passed: boolean;
  readonly meta: unknown;
}
