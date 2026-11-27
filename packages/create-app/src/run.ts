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

const diag = (code: string, message: string, path?: string, paths?: readonly string[]): OutDiag => ({
  kind: "diag",
  code,
  ...(path === undefined || path === "" ? {} : { path, line: 1, col: 1 }),
  message,
  ...(paths === undefined || paths.length < 2 ? {} : { paths }),
  see: "k.create",
});
const failed = (d: OutDiag): Out[] => [d, { kind: "summary", name: "create", ok: false, counts: { errors: 1 } }];

/**
 * `create-app [folder] [flags]` (k.create): parse, read the folder and the Workspace files, plan, write all or nothing,
 * and print in docs/OUTPUT.md's format (compact when standard output is no terminal, `KEEL_AGENT=1` or `CI` is set).
 * It reads no standard input and starts no process. Exit 0 written (or planned, `--dry-run`), 1 refused, 2 E1052.
 */
export function run(p: Process): { readonly stdout: string; readonly code: number } {
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
  });
  if (!planned.ok) {
    const d = planned.error.data;
    return print(failed(diag(d.code, d.message, d.path, d.paths)), d.code === "E1052" ? 2 : 1);
  }
  const { files, records } = planned.value;
  const at = (path: string): string => (flags.folder === "." ? path : posix.join(flags.folder, path));
  if (!flags.dryRun) {
    const wrote = writePlan(disk.abs, files);
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
            `${wrote.failed} could not be written (${wrote.reason}); this run's files are removed`,
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
  return print([...records, { kind: "summary", name: label, ok: true, counts: { created: files.size } }], 0);
}
