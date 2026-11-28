// The isolation probe and the transcript audit of the public mode. The probe fails when anything outside the project
// is reachable from it; the audit fails when an agent's transcript reads the repository or the user's `~/.claude`.
// `--dangerously-skip-permissions` stays on, so these two are the guard, not a sandbox.
import { access, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { isRecord, sh } from "./run.ts";

export type Finding = { code: "V0008" | "V0009"; where: string; message: string };

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const within = (path: string, base: string): boolean =>
  path === base || path.startsWith(base.endsWith(sep) ? base : base + sep);

/** Files that make a parent folder part of an agent's context, or of its module resolution, when found above a project. */
const CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".claude", "package.json", "pnpm-workspace.yaml", "node_modules"];

/**
 * V0008 findings for a project at `dir` and a repository at `repo`: the project inside the repo; a context file in any
 * folder above the project; an installed `@keel/*` that resolves into the repo (checked by running Node's resolver
 * from the project, as a build does); and, when `claudeReply` is given, a loaded skill or memory file outside the
 * project in the agent's own answer.
 */
export async function probe(dir: string, repo: string, claudeReply?: string): Promise<Finding[]> {
  const found: Finding[] = [];
  const project = await realpath(dir);
  const root = await realpath(repo);
  if (within(project, root)) found.push({ code: "V0008", where: dir, message: "the project is inside the repository" });
  for (let up = dirname(project); up !== dirname(up); up = dirname(up))
    for (const f of CONTEXT_FILES)
      if (await exists(join(up, f)))
        found.push({ code: "V0008", where: join(up, f), message: "context file above the project" });
  const script = `
    const { createRequire } = require("node:module");
    const { readdirSync, realpathSync } = require("node:fs");
    const req = createRequire(process.cwd() + "/");
    const out = [];
    for (const d of readdirSync("node_modules/@keel")) {
      try { out.push(realpathSync(req.resolve("@keel/" + d + "/package.json"))); } catch { out.push("unresolved:" + d); }
    }
    console.log(JSON.stringify(out));`;
  const r = await sh("node", ["-e", script], project);
  if (!r.ok) found.push({ code: "V0008", where: dir, message: `resolving @keel/* failed: ${r.output.slice(-200)}` });
  else {
    const list: unknown = JSON.parse(r.output.trim().split("\n").pop() ?? "[]");
    if (Array.isArray(list))
      for (const p of list)
        if (typeof p === "string" && within(p, root))
          found.push({ code: "V0008", where: p, message: "@keel package resolves into the repository" });
  }
  if (claudeReply !== undefined) found.push(...replyFindings(claudeReply, project, root));
  return found;
}

/** V0008 findings in an agent's reply to the probe question: any path in it that is neither inside the project nor in `node_modules`. */
export function replyFindings(reply: string, project: string, repo: string): Finding[] {
  const home = homedir();
  const found: Finding[] = [];
  // macOS reports a temp folder as /private/var/...; the project may be spelled /var/...
  const projects = [project, project.startsWith("/private/") ? project.slice("/private".length) : `/private${project}`];
  const inProject = (p: string): boolean => projects.some((b) => within(p, b));
  for (const m of reply.matchAll(/(?:~|\/|\.{0,2}[\w.@+-]*\/)[\w.@+/-]*/g)) {
    const p = m[0];
    if (p.length < 4) continue;
    // A relative path (`.claude/skills/keel/SKILL.md`) is the project's own.
    const abs = p.startsWith("~") ? join(home, p.slice(1)) : p.startsWith("/") ? p : join(project, p);
    if (within(abs, repo) || within(abs, join(home, ".claude")))
      found.push({ code: "V0008", where: p, message: "the agent reports a skill or memory file outside the project" });
    else if (abs.startsWith("/") && !inProject(abs) && /(CLAUDE|MEMORY|SKILL)\.md$/.test(abs))
      found.push({ code: "V0008", where: p, message: "the agent reports a skill or memory file outside the project" });
  }
  return found;
}

/** The question the probe sends the agent before the first iteration. */
export const PROBE_PROMPT =
  "List, one path per line, every CLAUDE.md, AGENTS.md, memory file and skill you have loaded in this session. Answer with the paths only. Do not read or write anything.";

type ToolUse = { name: string; input: Record<string, unknown> };

/** The tool calls of a `stream-json` transcript (one JSON object per line), in order. */
export function toolUses(transcript: string): ToolUse[] {
  const out: ToolUse[] = [];
  for (const line of transcript.split("\n")) {
    if (line.trim() === "") continue;
    let e: unknown;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = isRecord(e) ? e["message"] : undefined;
    const content = isRecord(msg) ? msg["content"] : undefined;
    if (!Array.isArray(content)) continue;
    for (const c of content)
      if (isRecord(c) && c["type"] === "tool_use" && typeof c["name"] === "string" && isRecord(c["input"]))
        out.push({ name: c["name"], input: c["input"] });
  }
  return out;
}

const PATH_KEYS = ["file_path", "path", "notebook_path", "cwd", "directory"];

/**
 * V0009 findings: every tool call of `transcript` that touches a path under `repo` or under `~/.claude`. A path key
 * (`file_path`, `path`, ...) is resolved against the project first, so `../../x` counts; a `Bash` command or a search
 * pattern is searched for the forbidden roots as text, with `~` and `$HOME` spelled out.
 */
export function audit(transcript: string, project: string, repo: string): Finding[] {
  const home = homedir();
  const forbidden = [repo, join(home, ".claude")];
  // Claude Code spills a tool result that is too large into `~/.claude/projects/<project>/<session>/tool-results/` and
  // tells the agent to read it from there (with a `*` for the project folder, as often): a spill file is not a read of
  // the user's `~/.claude`.
  const projects = join(home, ".claude", "projects");
  const spillText = new RegExp(
    `${projects.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/\\s"']+/[0-9a-f-]{36}/tool-results/`,
    "g",
  );
  const isSpill = (path: string): boolean => {
    const parts = within(path, projects) ? path.slice(projects.length + 1).split(sep) : [];
    return parts.length > 3 && /^[0-9a-f-]{36}$/.test(parts[1] ?? "") && parts[2] === "tool-results";
  };
  const spelled = (s: string): string =>
    s
      .replaceAll("$HOME", home)
      .replaceAll("${HOME}", home)
      .replace(/(^|[\s"'=:])~\//g, `$1${home}/`);
  const found: Finding[] = [];
  for (const use of toolUses(transcript)) {
    const targets: string[] = [];
    for (const k of PATH_KEYS) {
      const v = use.input[k];
      if (typeof v === "string") targets.push(isAbsolute(v) ? v : resolve(project, spelled(v)));
    }
    const texts = ["command", "pattern", "glob", "url"]
      .map((k) => use.input[k])
      .filter((v): v is string => typeof v === "string");
    for (const t of targets)
      for (const f of forbidden)
        if (within(spelled(t), f) && !isSpill(spelled(t)))
          found.push({ code: "V0009", where: t, message: `${use.name} reads outside the project` });
    for (const t of texts)
      for (const f of forbidden)
        if (spelled(t).replace(spillText, "").includes(f))
          found.push({
            code: "V0009",
            where: `${f}: ${t.slice(0, 400)}`,
            message: `${use.name} names a path outside the project`,
          });
  }
  return found;
}

/** Reads a transcript file and audits it. */
export async function auditFile(file: string, project: string, repo: string): Promise<Finding[]> {
  return audit(await readFile(file, "utf8"), project, repo);
}
