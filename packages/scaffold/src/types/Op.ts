/** A k.scaffold operation: seven generators and three codemods. */
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
  | "add-field";
