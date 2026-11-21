import { type Result, ok } from "@keel/schema";
import { fail } from "../internal/fail.ts";
import { sortedKeys } from "../internal/sortedKeys.ts";
import { agentsBlock } from "../templates/agentsBlock.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";
import type { DeployDrift } from "../types/DeployDrift.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { AGENTS_END } from "./AGENTS_END.ts";
import { AGENTS_START } from "./AGENTS_START.ts";

const lineIs = (marker: string) => (l: string) => l.replace(/\r$/, "") === marker;

/**
 * The agent files of a project tree (path -> text) that differ from what `keel docs --sync` writes, sorted by path
 * (k.scaffold Agent files): `AGENTS.md` with the Keel block replaced in place or appended after the user's text,
 * `CLAUDE.md` (`@AGENTS.md`) only when absent, and `.claude/skills/<name>/SKILL.md` for each skill. An `AGENTS.md`
 * whose markers are not one start line followed by one end line is E1355; nothing is written. A CRLF `AGENTS.md` gets
 * the block in CRLF.
 */
export function agentFiles(
  files: ReadonlyMap<string, string>,
  skills: readonly AgentSkill[],
): Result<DeployDrift[], ScaffoldError> {
  const have = files.get("AGENTS.md");
  const nl = have?.includes("\r\n") === true ? "\r\n" : "\n";
  const block = agentsBlock(skills).replaceAll("\n", nl);
  const lines = (have ?? "").split("\n");
  const starts = lines.flatMap((l, i) => (lineIs(AGENTS_START)(l) ? [i] : []));
  const ends = lines.flatMap((l, i) => (lineIs(AGENTS_END)(l) ? [i] : []));
  const [start] = starts;
  const [end] = ends;
  let agents: string;
  if (starts.length === 0 && ends.length === 0)
    agents =
      have === undefined || have === "" ? `${block}\n` : `${have}${have.endsWith("\n") ? "" : nl}${nl}${block}${nl}`;
  else if (starts.length === 1 && ends.length === 1 && start !== undefined && end !== undefined && start < end)
    agents = [
      ...lines.slice(0, start),
      `${block}${lines[end]?.endsWith("\r") === true ? "\r" : ""}`,
      ...lines.slice(end + 1),
    ].join("\n");
  else return fail("E1355", "AGENTS.md", `AGENTS.md needs one ${AGENTS_START} line, then one ${AGENTS_END} line`);
  const want = new Map<string, string>([["AGENTS.md", agents]]);
  if (!files.has("CLAUDE.md")) want.set("CLAUDE.md", "@AGENTS.md\n");
  for (const s of skills) want.set(`.claude/skills/${s.name}/SKILL.md`, s.text);
  const out: DeployDrift[] = [];
  for (const path of sortedKeys(want.keys())) {
    const text = want.get(path) ?? null;
    const now = files.get(path) ?? null;
    if (text !== now) out.push({ path, want: text, have: now });
  }
  return ok(out);
}
