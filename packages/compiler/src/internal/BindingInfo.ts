/** One emitted binding: the element it writes, its op, and the identifiers its expression reads. */
export type BindingInfo = {
  element: string;
  kind: "text" | "attr" | "prop" | "on" | "cond" | "list" | "match";
  name: string;
  reads: string[];
  props: string[];
};
