import { posix } from "node:path";
import { createPlan, managerOf, managerWord } from "@keel/scaffold/create";
import type { Out } from "./Out.ts";
import type { OutDiag } from "./OutDiag.ts";
import type { Process } from "./Process.ts";
import { ownPackage } from "./ownPackage.ts";
import { parseFlags } from "./parseFlags.ts";
import { readInputs } from "./readInputs.ts";
import { render } from "./render.ts";
import { writePlan } from "./writePlan.ts";

/** A diagnostic of the run; one about the folder or its writes cites k.create-folder (the plan's carry their own `see`). */
const diag = (
  code: string,
  message: string,
  path?: string,
  paths?: readonly string[],
  see = /^E13(?:60|61|65|66|67)$|^E1357$/.test(code) ? "k.create-folder" : "k.create",
): OutDiag => ({
  kind: "diag",
  code,
  ...(path === undefined || path === "" ? {} : { path, line: 1, col: 1 }),
  message,
  ...(paths === undefined || paths.length < 2 ? {} : { paths }),
  see,
});
/** E1365's fix by the write's error code (k.create-folder Rules); the message stays within docs/OUTPUT.md's 89. */
const fixFor = (code: string): string =>
  code === "EACCES" || code === "EPERM" || code === "EROFS"
    ? "grant write permission there"
    : code === "ENOSPC" || code === "EDQUOT"
      ? "free disk space"
      : "free the path";
const failed = (d: OutDiag): Out[] => [d, { kind: "summary", name: "create", ok: false, counts: { errors: 1 } }];

/**
 * `create-app [folder] [flags]` (k.create): parse, read the folder and the Workspace files, plan, write all or nothing,
 * and print in docs/OUTPUT.md's format (compact when standard output is no terminal, `KEEL_AGENT=1` or `CI` is set).
 * It reads no standard input and starts no process. Exit 0 written (or planned, `--dry-run`), 1 refused, 2 E1052, 130
 * or 143 when `p.interrupted` or `p.stopped` reports SIGINT or SIGTERM during the writes (E1367). `seams` stand in for the file system's
 * case (`caseless`) and observe each write (`written`), so tests reach both cases and a signal mid-write on any machine.
 */
export async function run(
  p: Process,
  seams: { readonly caseless?: boolean; readonly written?: (path: string) => void } = {},
): Promise<{ readonly stdout: string; readonly code: number }> {
  const flags = parseFlags(p.argv);
  const word = managerWord(p.env.npm_config_user_agent);
  const run = managerOf(word.packageManager ?? `${word.name}@`).run;
  const agent = p.env.KEEL_AGENT === "1" || (p.env.CI !== undefined && p.env.CI !== "" && p.env.CI !== "false");
  const fallback = p.tty && !agent ? "pretty" : "compact";
  if ("usage" in flags) {
    const format = p.argv.includes("--format=json") ? "json" : fallback;
    return { stdout: render(failed(diag("E1052", flags.usage)), format, false, undefined, run), code: 2 };
  }
  const format = flags.format ?? fallback;
  const print = (records: readonly Out[], code: number) => ({
    stdout: render(records, format, flags.quiet, flags.limit, run),
    code,
  });
  const own = ownPackage();
  const disk = readInputs(p.cwd, flags.folder);
  const planned = createPlan({
    version: own.version,
    nodeVersion: p.nodeVersion,
    skills: own.skills,
    folder: flags.folder,
    name: flags.name,
    adapter: flags.adapter,
    library: flags.library,
    existing: flags.existing,
    listing: disk.listing,
    ancestors: disk.ancestors,
    realPath: disk.realPath,
    gitAbove: disk.gitAbove,
    userAgent: p.env.npm_config_user_agent,
    cwd: p.cwd,
    caseless: seams.caseless ?? disk.caseless,
  });
  if (!planned.ok) {
    const d = planned.error.data;
    return print(failed(diag(d.code, d.message, d.path, d.paths, d.see)), d.code === "E1052" ? 2 : 1);
  }
  const { files, records } = planned.value;
  const at = (path: string): string => (flags.folder === "." ? path : posix.join(flags.folder, path));
  if (!flags.dryRun) {
    const wrote = await writePlan(disk.abs, files, {
      stopped: p.stopped,
      interrupted: p.interrupted,
      written: seams.written,
    });
    if ("stopped" in wrote)
      return print(
        failed(diag("E1367", `${wrote.stopped} stopped the writes; this run's files are removed; run it again`)),
        wrote.stopped === "SIGINT" ? 130 : 143,
      );
    if ("linked" in wrote)
      return print(
        failed(diag("E1357", "a symlink leads this write out of the folder; nothing written", at(wrote.linked))),
        1,
      );
    if ("failed" in wrote)
      return print(
        failed(
          diag(
            "E1365",
            `not written (${wrote.reason.slice(0, 12)}); this run's files are removed; ${fixFor(wrote.reason)}`,
            at(wrote.failed),
          ),
        ),
        1,
      );
  }
  const pkg: unknown = JSON.parse(files.get("package.json") ?? "{}");
  const name: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "name") : undefined;
  const kind = flags.library === undefined ? (flags.adapter ?? "client") : "library";
  const label = `create${flags.dryRun ? " --dry-run" : ""} ${typeof name === "string" ? name : ""} ${kind}`;
  // A dry run prints what it would create, under its own verb and count; each of its records says so (k.create Next).
  const shown: Out[] = flags.dryRun ? records.map((r) => ({ ...r, "dry-run": true })) : [...records];
  const counts = flags.dryRun ? { planned: files.size } : { created: files.size };
  return print(
    [...shown, { kind: "summary", name: label, ok: true, counts, ...(flags.dryRun ? { "dry-run": true } : {}) }],
    0,
  );
}
