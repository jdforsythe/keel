/** A k.scaffold operation: eight generators and four codemods. */
export type Op =
  | "project"
  | "module"
  | "route"
  | "component"
  | "store"
  | "transaction"
  | "service"
  | "shell"
  | "rename"
  | "move"
  | "place"
  | "add-field";
