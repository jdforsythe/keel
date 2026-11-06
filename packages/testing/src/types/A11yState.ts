/** Accessibility state of one element; a key is present only when it applies (k.testing a11y). */
export interface A11yState {
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly expanded?: boolean;
  readonly selected?: boolean;
  readonly invalid?: boolean;
  readonly focused?: boolean;
}
