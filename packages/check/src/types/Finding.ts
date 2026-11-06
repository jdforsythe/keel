/** What a rule's `check` returns per hit: 1-based location plus optional rule-private data (offsets, names). */
export type Finding = {
  readonly path: string;
  readonly line: number;
  readonly col: number;
  readonly data?: Readonly<Record<string, string | number>>;
};
