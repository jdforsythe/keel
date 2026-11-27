import { parseSync } from "oxc-parser";
import type { Input } from "../../types/Input.ts";
import type { Io } from "../../types/Io.ts";
import type { Outcome } from "../Outcome.ts";
import { isRecord } from "../isRecord.ts";
import { keelModule } from "../keelModule.ts";
import { makeDiag } from "../makeDiag.ts";
import { summary } from "../summary.ts";
import type { Val } from "./Val.ts";
import { applySourceEdits } from "./applySourceEdits.ts";
import { brandTokensOf } from "./brandTokensOf.ts";
import { finishWrites } from "./finishWrites.ts";
import { importFacts } from "./importFacts.ts";
import { literalValue } from "./literalValue.ts";
import { parseTokenPath } from "./parseTokenPath.ts";
import { readText } from "./readText.ts";
import { setEdits } from "./setEdits.ts";
import { spreadHolds } from "./spreadHolds.ts";
import { staticValue } from "./staticValue.ts";

const NAME = "tokens set";
const TOKENS = "tokens.ts";
const DESIGN = "tokens.design.ts";

const refusal = (message: string): Outcome => {
  const d = makeDiag("E1071", message, { see: "k.cli" });
  return { records: [d, summary(NAME, [d], {})], writes: [] };
};

/** Whether `fragment` passes the project's `TokenSchema`; undefined when `@keel/ui/tokens` does not load. */
async function passes(cwd: string, fragment: unknown): Promise<boolean | undefined> {
  const schema = (await keelModule(cwd, "@keel/ui/tokens"))?.TokenSchema;
  const parse = isRecord(schema) ? schema.parse : undefined;
  if (typeof parse !== "function") return undefined;
  const result: unknown = parse.call(schema, fragment);
  return isRecord(result) && result.ok === true;
}

/** The value `chain` holds in what `tokens.ts` spreads: `designTokens` (read from `tokens.design.ts`) over `brandTokens`. */
async function spreadValue(
  io: Io,
  imports: ReturnType<typeof importFacts>,
  chain: readonly string[],
): Promise<Val | undefined> {
  const design = imports.from.has("designTokens") ? readText(io.cwd, DESIGN) : undefined;
  if (design !== undefined) {
    const program = parseSync(DESIGN, design, { sourceType: "module", lang: "ts" }).program;
    const found = staticValue(program, chain);
    if (found !== undefined) return found;
  }
  if (!imports.from.has("brandTokens")) return undefined;
  let at: unknown = await brandTokensOf(io.cwd);
  for (const key of chain) at = isRecord(at) ? at[key] : undefined;
  if (typeof at === "string") return at;
  return isRecord(at) && typeof at.light === "string" && typeof at.dark === "string"
    ? { light: at.light, dark: at.dark }
    : undefined;
}

/**
 * `keel tokens set <path> <value>` (k.cli Tokens): one value of `tokens.ts`'s `tokens` literal. A path of another
 * form, or a value that fails the project's `TokenSchema`, is E1071 and nothing is written.
 */
export async function tokensSetCommand(input: Input, io: Io): Promise<Outcome> {
  const [path, value] = input.args ?? [];
  if (path === undefined || value === undefined) {
    const d = makeDiag("E1052", "tokens set takes a path and a value", { see: "k.cli" });
    return { records: [d, summary(NAME, [d], {})], writes: [] };
  }
  const parsed = parseTokenPath(path);
  if (parsed === undefined) return refusal(`${path} is not a token path`);
  const { group, name, scheme } = parsed;
  const entry = scheme === undefined ? value : { light: value, dark: value };
  const ok = await passes(io.cwd, { [group]: { [name]: entry } });
  if (ok === undefined) return refusal(`${path}: @keel/ui/tokens does not load here`);
  if (!ok || (scheme !== undefined && group !== "color")) return refusal(`${path}: ${value} fails TokenSchema`);
  const source = readText(io.cwd, TOKENS);
  if (source === undefined) return refusal(`${TOKENS} is missing`);
  const program = parseSync(TOKENS, source, { sourceType: "module", lang: "ts" }).program;
  const imports = importFacts(program);
  const chain = [...(parsed.theme === undefined ? [] : ["themes", parsed.theme]), group, name];
  const current = scheme === undefined ? undefined : await spreadValue(io, imports, chain);
  const edits = setEdits(program, parsed, value, current, spreadHolds(imports, await brandTokensOf(io.cwd)));
  if (edits === undefined) return refusal(`${TOKENS} has no object literal at ${path} to edit`);
  const next = applySourceEdits(source, edits);
  return finishWrites(
    io,
    [summary(NAME, [], { changed: next === source ? 0 : 1 })],
    [{ path: TOKENS, content: next, readonly: false }],
  );
}
