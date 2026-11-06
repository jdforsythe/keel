/** The run summary: `ok` when no E diagnostic; counts per code (sorted) and per severity. */
export type Summary = {
  readonly kind: "summary";
  readonly ok: boolean;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly counts: Readonly<Record<string, number>>;
};
