import type { Program } from "oxc-parser";
import type { SourceFile } from "./SourceFile.ts";

/**
 * What a rule's `check` receives: one file, its oxc AST, read-only project artifacts (`ids.json`, ...), and
 * `project`: the code files of the file's project (the group `check()` compiles together, paths as given, with that
 * project's `topology.ts`), the same array for every file of the project (rfc:0070). Rules report only on `file`.
 * `dates`: with the type pass on, the offsets in `file` of the expressions E1758 reads whose type is `Date`.
 */
export type RuleInput = {
  readonly file: SourceFile;
  readonly ast: Program;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly project: readonly SourceFile[];
  readonly dates?: ReadonlySet<number>;
  /** With the type pass on, the offsets in `file` of what the checker resolves to `@keel/ui`'s `SchemeSelect`. */
  readonly schemeSelects?: ReadonlySet<number>;
};
