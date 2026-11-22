/**
 * A `gap` or `direction` written at a use: its breakpoint keys (`["base"]` for a plain token, `null` when not
 * readable statically), where the prop starts, and, for an object literal value, the offset after its `{`.
 */
export type StyleProp = {
  readonly keys: readonly string[] | null;
  readonly start: number;
  readonly open?: number;
};
