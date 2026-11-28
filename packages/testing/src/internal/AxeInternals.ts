interface RawNode {
  readonly node: { readonly element: Element } | null;
}
interface RawResult {
  readonly id: string;
  readonly result: string;
  readonly help: string;
  /** Set by `after` when the rule's aggregation threw (`createIncompleteErrorResult`). */
  readonly error?: unknown;
  /** The failed nodes, grouped by `finalizeRuleResult`. */
  readonly violations: readonly RawNode[];
}
interface Rule {
  readonly id: string;
  runSync(context: object, options: object): object;
}
interface Audit {
  readonly rules: readonly Rule[];
  after(results: readonly object[], options: object): object[];
}
export interface AxeInternals {
  readonly _audit: Audit;
  _tree: unknown;
  _selectorData: unknown;
  _selectCache: unknown;
  readonly _thisWillBeDeletedDoNotUse: {
    readonly base: {
      readonly Context: new (spec: Element | Document | { include: unknown[]; exclude: unknown[] }) => Ctx;
    };
  };
  readonly utils: {
    getSelectorData(tree: unknown): unknown;
    publishMetaData(result: object): void;
    finalizeRuleResult(result: object): RawResult;
  };
  teardown(): void;
}
interface Ctx {
  readonly flatTree: unknown;
}
