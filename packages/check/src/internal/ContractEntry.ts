import type { ObjectExpression, ObjectProperty } from "oxc-parser";

/** One entry of a `contract(id, entries)` literal: its key, its object (`null` when not a literal) and its kind. */
export type ContractEntry = {
  readonly id: string;
  readonly prop: ObjectProperty;
  readonly obj: ObjectExpression | null;
  readonly kind: "page" | "layout" | "api";
};
