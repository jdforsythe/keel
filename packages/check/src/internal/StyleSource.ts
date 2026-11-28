import type { StyleProp } from "./StyleProp.ts";

/**
 * The style props E1809 reads from one style object at a use: an element's attributes (`jsx`), a part style or a
 * `states` entry. `look` is the literal look name, `null` when computed; `spread` is a spread that may carry a
 * `direction`.
 */
export type StyleSource = {
  readonly jsx: boolean;
  readonly gap?: StyleProp;
  readonly direction?: StyleProp;
  readonly look?: string | null;
  readonly spread: boolean;
  readonly states: ReadonlyMap<string, StyleSource>;
};
