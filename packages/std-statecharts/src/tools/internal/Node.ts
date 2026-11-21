/** An ESTree node of the oxc AST `keel check` hands a rule, read field by field. */
export type Node = {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
};
