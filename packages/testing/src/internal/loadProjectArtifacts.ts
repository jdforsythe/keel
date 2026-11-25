import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TokenSchema } from "@keel/ui";
import type { HarnessArtifacts } from "../types/HarnessArtifacts.ts";
import type { ProjectArtifacts } from "./ProjectArtifacts.ts";
import { a11yEntries } from "./a11yEntries.ts";

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

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
 * and the `tokens` export of `tokens.ts`, if present. A `tokens.ts` that throws, exports no `tokens` or whose
 * `tokens` fail `TokenSchema` gives the reason instead.
 */
export async function loadProjectArtifacts(dir: string): Promise<ProjectArtifacts> {
  const a11y = a11yJson(dir);
  const file = join(dir, "tokens.ts");
  if (!existsSync(file)) return { ok: true, artifacts: a11y };
  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ file);
  } catch (e) {
    return { ok: false, reason: `tokens.ts failed to evaluate: ${messageOf(e)}` };
  }
  const tokens: unknown = typeof mod === "object" && mod !== null ? Reflect.get(mod, "tokens") : undefined;
  if (tokens === undefined) return { ok: false, reason: "tokens.ts exports no tokens" };
  const parsed = TokenSchema.parse(tokens);
  if (!parsed.ok) return { ok: false, reason: `tokens.ts: tokens fail TokenSchema: ${parsed.error.message}` };
  return { ok: true, artifacts: { ...a11y, tokens: parsed.value } };
}
