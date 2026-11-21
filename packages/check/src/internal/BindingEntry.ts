import type { ObjectExpression, ObjectProperty } from "oxc-parser";

/** One entry of a `manifest(contract, binding)` binding literal: its key and its object (`null` when not a literal). */
export type BindingEntry = {
  readonly id: string;
  readonly prop: ObjectProperty;
  readonly obj: ObjectExpression | null;
};
