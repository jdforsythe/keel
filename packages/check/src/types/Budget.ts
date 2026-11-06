/** One measured budget (`budgets.json`): `actual` above `limit` is E1755 at `path` (default `budgets.json`). */
export type Budget = {
  readonly id: string;
  readonly limit: number;
  readonly actual: number;
  readonly unit: "tokens" | "bytes";
  readonly path?: string;
};
