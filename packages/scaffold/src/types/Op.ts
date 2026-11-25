/** A k.scaffold operation: nine generators (`library` from k.library-pack) and four codemods. */
export type Op =
  | "project"
  | "module"
  | "route"
  | "component"
  | "store"
  | "transaction"
  | "service"
  | "shell"
  | "library"
  | "rename"
  | "move"
  | "place"
  | "add-field";
