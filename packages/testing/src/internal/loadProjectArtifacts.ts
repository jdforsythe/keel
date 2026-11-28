import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectTokens } from "@keel/compiler/hosting/projectTokens";
import { TokenSchema } from "@keel/ui/tokens";
import type { HarnessArtifacts } from "../types/HarnessArtifacts.ts";
import type { ProjectArtifacts } from "./ProjectArtifacts.ts";
import { a11yEntries } from "./a11yEntries.ts";

/** `.keel/a11y.json` of `dir`, if present and JSON; else none. */
const a11yJson = (dir: string): Pick<HarnessArtifacts, "a11y.json"> => {
  const file = join(dir, ".keel", "a11y.json");
  if (!existsSync(file)) return {};
  try {
    return { "a11y.json": a11yEntries(JSON.parse(readFileSync(file, "utf8"))) };
  } catch {
    return {};
  }
};

/**
 * The artifacts of the project in `dir` (k.a11y Artifacts): `.keel/a11y.json` as the compiler writes it, if present,
 * and the `tokens` export of `tokens.ts`, if present, evaluated as `keel check` and `keel build` evaluate it
 * (`projectTokens` of `@keel/compiler`: bundled with the `keel` condition, a library's shipped tokens read from their
 * literal, k.looks), never by the runtime's own loader. A `tokens.ts` that throws, exports no `tokens` or whose
 * `tokens` fail `TokenSchema` gives the reason instead, each naming `tokens.ts` (the last with the first issue's
 * `<path>: <what>`).
 */
export async function loadProjectArtifacts(dir: string): Promise<ProjectArtifacts> {
  const a11y = a11yJson(dir);
  const evaluated = await projectTokens(dir);
  if (evaluated === undefined) return { ok: true, artifacts: a11y };
  if (!evaluated.ok) {
    const schema = evaluated.path !== undefined;
    return { ok: false, reason: schema ? `tokens.ts: tokens fail TokenSchema: ${evaluated.reason}` : evaluated.reason };
  }
  const parsed = TokenSchema.parse(evaluated.tokens);
  if (!parsed.ok) return { ok: false, reason: `tokens.ts: tokens fail TokenSchema: ${parsed.error.message}` };
  return { ok: true, artifacts: { ...a11y, tokens: parsed.value } };
}
