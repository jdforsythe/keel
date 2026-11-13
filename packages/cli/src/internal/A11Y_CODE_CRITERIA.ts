/**
 * Keel codes and the WCAG criteria they check (k.a11y Claims), with whether each runs at render (`keel test`) or only
 * statically (`keel check`). E1804 runs at both; axe-core's `color-contrast` is replaced by it.
 */
export const A11Y_CODE_CRITERIA: readonly {
  readonly code: string;
  readonly criteria: readonly string[];
  readonly render: boolean;
}[] = [
  { code: "E1702", criteria: ["4.1.2"], render: true },
  { code: "E1802", criteria: ["1.1.1", "1.3.1", "2.4.4", "4.1.2"], render: false },
  { code: "E1804", criteria: ["1.4.3"], render: true },
  { code: "E1820", criteria: ["1.3.2", "2.4.3"], render: false },
  { code: "E1821", criteria: ["1.3.5"], render: true },
];
