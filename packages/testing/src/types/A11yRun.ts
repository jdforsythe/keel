/**
 * One render check of a test (k.a11y Claims), as `keel test` writes it to `reports/a11y.json`: what was rendered (a
 * module-qualified route id for `renderRoute`, else the component's name), the rules that reached a verdict (axe-core
 * rule ids, and E1702, E1804, E1821 when they ran), each violation's rule and element id, and the test that rendered it.
 */
export interface A11yRun {
  readonly route: string | null;
  readonly component: string | null;
  readonly rules: readonly string[];
  readonly violations: readonly { readonly rule: string; readonly element: string }[];
  /** The test file, relative to the project root, with `/` separators. */
  readonly file: string;
  /** The test's full name (its suites and its own name, joined by spaces). */
  readonly test: string;
  readonly passed: boolean;
}
