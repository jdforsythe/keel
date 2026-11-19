/** The commands of the k.cli Commands table. `mcp` and `lsp` are surfaces, not operations. */
export type CommandName =
  | "check"
  | "test"
  | "build"
  | "dev"
  | "spec"
  | "explain"
  | "inspect"
  | "render"
  | "scaffold"
  | "codemod"
  | "ledger"
  | "evidence"
  | "session";
