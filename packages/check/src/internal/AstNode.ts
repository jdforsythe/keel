/** Any node of an oxc syntax tree, read generically: its `type`, offsets and fields by name. */
export type AstNode = {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [field: string]: unknown;
};
