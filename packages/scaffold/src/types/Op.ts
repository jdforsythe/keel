/** A k.scaffold operation: seven generators and four codemods. */
export type Op =
  | "project"
  | "module"
  | "route"
  | "component"
  | "store"
  | "transaction"
  | "service"
  | "rename"
  | "move"
  | "place"
  | "add-field";
