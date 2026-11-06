import type { Program } from "oxc-parser";
import type { SourceFile } from "./SourceFile.ts";

/** What a rule's `check` receives: one file, its oxc AST, and read-only project artifacts (`ids.json`, ...). */
export type RuleInput = {
  readonly file: SourceFile;
  readonly ast: Program;
  readonly artifacts: Readonly<Record<string, unknown>>;
};
