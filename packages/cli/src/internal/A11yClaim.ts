/** One `a11y:<routeId>#<criterion>` ledger item (k.a11y Claims): `example` or `none`, with its evidence line. */
export type A11yClaim = {
  readonly item: string;
  readonly route: string;
  readonly criterion: string;
  readonly rung: "none" | "example";
  readonly evidence: string;
  /** True when the project holds no `reports/a11y.json` and the committed rung is kept. */
  readonly kept?: true;
};
