import { parseSync } from "oxc-parser";
import type { Input } from "../../types/Input.ts";
import type { Io } from "../../types/Io.ts";
import type { OutRecord } from "../../types/OutRecord.ts";
import type { Write } from "../../types/Write.ts";
import type { Outcome } from "../Outcome.ts";
import { makeDiag } from "../makeDiag.ts";
import { summary } from "../summary.ts";
import type { DesignFile } from "./DesignFile.ts";
import { applySourceEdits } from "./applySourceEdits.ts";
import { assemble } from "./assemble.ts";
import { brandTokensOf } from "./brandTokensOf.ts";
import { designGroups } from "./designGroups.ts";
import { designSpreadEdits } from "./designSpreadEdits.ts";
import { finishWrites } from "./finishWrites.ts";
import { importFacts } from "./importFacts.ts";
import { lineCol } from "./lineCol.ts";
import { readDesignFile } from "./readDesignFile.ts";
import { readText } from "./readText.ts";
import { renderDesignTokens } from "./renderDesignTokens.ts";
import { spreadHolds } from "./spreadHolds.ts";

const NAME = "tokens import";
const DESIGN = "tokens.design.ts";
const TOKENS = "tokens.ts";
const FIRST_TOKENS = 'import { designTokens } from "./tokens.design.ts";\n\nexport const tokens = designTokens;\n';

const refusal = (message: string): Outcome => {
  const d = makeDiag("E1071", message, { see: "k.cli" });
  return { records: [d, summary(NAME, [d], {})], writes: [] };
};

/**
 * `keel tokens import <file>...` (k.cli Tokens): the files in the Design Tokens Community Group format as
 * `tokens.design.ts`, written whole, and `tokens.ts` taking `designTokens` when it does not yet. Each W1072 is
 * printed at the `"$value"` key (or dropped field) of its token in the file that holds it. A file that is not JSON or
 * holds no `$value` is E1071, and nothing is written.
 */
export async function tokensImportCommand(input: Input, io: Io): Promise<Outcome> {
  const given = input.args ?? [];
  if (given.length === 0) {
    const d = makeDiag("E1052", "tokens import takes one or more design tokens files", { see: "k.cli" });
    return { records: [d, summary(NAME, [d], {})], writes: [] };
  }
  const files: DesignFile[] = [];
  const bad: OutRecord[] = [];
  for (const path of given) {
    const text = readText(io.cwd, path);
    const file = text === undefined ? undefined : readDesignFile(path, text);
    if (file === undefined) bad.push(makeDiag("E1071", `${path} is not a design tokens file`, { see: "k.cli" }));
    else files.push(file);
  }
  if (bad.length > 0) return { records: [...bad, summary(NAME, bad, {})], writes: [] };
  const assembled = assemble(files);
  const warns = assembled.warns.map((w) => {
    const file = files[w.file];
    const at = file === undefined ? { line: 1, col: 1 } : lineCol(file.text, w.at);
    return makeDiag("W1072", w.message, { path: file?.path, ...at });
  });
  const writes: Write[] = [{ path: DESIGN, content: renderDesignTokens(assembled), readonly: false }];
  const existing = readText(io.cwd, TOKENS);
  if (existing === undefined) writes.push({ path: TOKENS, content: FIRST_TOKENS, readonly: false });
  else {
    const program = parseSync(TOKENS, existing, { sourceType: "module", lang: "ts" }).program;
    const imports = importFacts(program);
    if (!imports.from.has("designTokens")) {
      const edits = designSpreadEdits(
        existing,
        program,
        designGroups(assembled),
        spreadHolds(imports, await brandTokensOf(io.cwd)),
      );
      if (edits === undefined) return refusal(`${TOKENS} has no tokens literal to add designTokens to`);
      writes.push({ path: TOKENS, content: applySourceEdits(existing, edits), readonly: false });
    }
  }
  const tokens = [...assembled.groups.values()].reduce((n, g) => n + g.size, 0);
  const records = [...warns, summary(NAME, [], { tokens, looks: assembled.looks.size, themes: assembled.themes.size })];
  return finishWrites(io, records, writes);
}
