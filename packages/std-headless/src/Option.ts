/** An option, menu item or tab (std.options): `key` names its part, `text` is what a person reads. */
export type Option<K extends string = string> = {
  readonly key: K;
  readonly text: string;
  /** Can be highlighted, never chosen or selected. */
  readonly disabled?: boolean;
};
