/** One axe-core rule as the harness selects it: id, tags, and whether axe enables it by default. */
export interface AxeRuleInfo {
  readonly id: string;
  readonly tags: readonly string[];
  readonly enabled: boolean;
}
