import type { Program } from "oxc-parser";
import type { SourceFile } from "./SourceFile.ts";

/**
 * What a rule's `check` receives: one file, its oxc AST, read-only project artifacts (`ids.json`, ...), and
 * `project`: the code files of the file's project (the group `check()` compiles together, paths as given, with that
 * project's `topology.ts`), the same array for every file of the project (rfc:0070). Rules report only on `file`.
 */
export type RuleInput = {
  readonly file: SourceFile;
  readonly ast: Program;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly project: readonly SourceFile[];
};
