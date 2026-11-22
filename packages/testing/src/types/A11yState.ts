/** Accessibility state of one element; a key is present only when it applies (k.testing a11y). */
export interface A11yState {
  /** `'mixed'` for a mixed checkbox (`aria-checked="mixed"`, or an indeterminate native one). */
  readonly checked?: boolean | "mixed";
  readonly disabled?: boolean;
  readonly expanded?: boolean;
  readonly selected?: boolean;
  readonly invalid?: boolean;
  readonly focused?: boolean;
  /** The id `aria-activedescendant` names. */
  readonly active?: string;
  /** The `aria-sort` value. */
  readonly sort?: string;
  /** The integer `aria-rowindex`. */
  readonly rowindex?: number;
  /** The integer `aria-rowcount`. */
  readonly rowcount?: number;
}
