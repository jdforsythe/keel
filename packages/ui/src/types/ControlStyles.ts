import type { PartStyle } from "../aria/PartStyle.ts";

/** A control's part styles (k.ui Base elements): `field` the wrapper, `label` its `<label>`, `error` its field error. */
export type ControlStyles = {
  readonly field?: PartStyle;
  readonly label?: PartStyle;
  readonly error?: PartStyle;
};
