import { posix } from "node:path";
import { type Result, err, ok } from "@keel/schema";
import { fail } from "../internal/fail.ts";
import { managerOf } from "../internal/managerOf.ts";
import { sortedKeys } from "../internal/sortedKeys.ts";
import { workspaceOf } from "../internal/workspaceOf.ts";
import type { CreateInput } from "../types/CreateInput.ts";
import type { CreatePlan } from "../types/CreatePlan.ts";
import type { CreateRecord } from "../types/CreateRecord.ts";
import type { ScaffoldDiag } from "../types/ScaffoldDiag.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { libraryTree } from "./libraryTree.ts";
import { managerWord } from "./managerWord.ts";
import { projectTree } from "./projectTree.ts";

const SEE = "k.create";
const AT = { line: 1, col: 1 };
/** Entries a folder may hold and still be empty (k.create Folder). */
const QUIET = new Set([".git", ".DS_Store", "Thumbs.db"]);
const NAME = /^[a-z][a-z0-9-]*$/;

const refuse = (code: string, path: string, message: string): Result<never, ScaffoldError> =>
  fail(code, path, message, undefined, AT, SEE);
const cut = (s: string, n = 24): string => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
/** A path a person can paste after `cd`: quoted when it holds anything but letters, digits and `._/-`. */
const shellPath = (p: string): string => (/^[A-Za-z0-9._/-]+$/.test(p) ? p : `'${p.replaceAll("'", "'\\''")}'`);

/** Whether `version` (`22.15.0`, `v22.15.0`) is older than 22.15; an unreadable one counts as older. */
function older(version: string): boolean {
  const m = /^v?(\d+)\.(\d+)/.exec(version);
  if (m === null) return true;
  const major = Number(m[1]);
  return major < 22 || (major === 22 && Number(m[2]) < 15);
}

/**
 * The plan of `create-app` (k.create): pure over its input, the files to write keyed from the folder and the records to
 * print, or the one diagnostic that refuses the run with nothing to write. In order: Node older than 22.15 (E1362),
 * `--adapter` with `--library` (E1052), the name (E1352), another `@keel/cli` above (E1363), a folder that is not empty
 * (E1360) or, with `existing`, a path the plan writes that exists (E1361). A folder the workspace's globs leave out is
 * W1364, and the files are planned.
 */
export function createPlan(input: CreateInput): Result<CreatePlan, ScaffoldError> {
  // A caller without types can leave `skills` out; the agent files would then be missing, so the plan is refused.
  if (!Array.isArray(input.skills))
    return refuse("E1052", "", "createPlan: skills is required (the skills the project copies)");
  if (older(input.nodeVersion))
    return refuse("E1362", "", `Node ${cut(input.nodeVersion, 16)} is older than 22.15; install Node 22.15 or later`);
  if (input.library !== undefined && input.adapter !== undefined)
    return refuse("E1052", "", "--adapter makes an app and --library a library; pass one of them");
  const folder = posix.normalize((input.folder ?? ".").replace(/\/+$/, "") || ".");
  const at = (p: string): string => (folder === "." ? p : posix.join(folder, p));
  const word = managerWord(input.userAgent);
  const m = managerOf(word.packageManager ?? `${word.name}@`);
  const leaf = posix.basename(folder === "." ? (input.realPath ?? "") : folder);
  const name = input.name ?? leaf;
  if (input.library === undefined) {
    if (!NAME.test(name)) {
      const fix = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const hint = NAME.test(fix) && fix.length <= 64 ? `--name ${cut(fix, 40)}` : "a --name of a-z, 0-9 and -";
      return refuse("E1352", "package.json", `project name ${cut(name)} is not [a-z][a-z0-9-]*; pass ${hint}`);
    }
    if (name.length > 64)
      return refuse("E1352", "package.json", "project name is over 64 characters; pass a shorter --name");
  }
  const ws = workspaceOf(folder, input.ancestors ?? {}, input.cwd);
  if (ws.cli !== undefined && ws.cli !== input.version)
    return refuse(
      "E1363",
      "",
      `@keel/cli ${cut(ws.cli, 16)} is above, create is ${cut(input.version, 16)}; run ${m.name} create @keel/app@${cut(ws.cli, 16)}`,
    );
  const listing = input.listing ?? [];
  if (input.existing !== true) {
    const busy = listing.find((p) => !QUIET.has(p.split("/")[0] ?? ""));
    if (busy !== undefined)
      return refuse("E1360", at(busy), `${cut(folder)}/ holds ${cut(busy)}; name a new folder, or add --existing`);
  }
  const member = ws.root !== undefined;
  const tree =
    input.library === undefined
      ? projectTree({
          name,
          adapter: input.adapter ?? "client",
          version: input.version,
          packageManager: word.packageManager,
          member,
          skills: input.skills,
        })
      : libraryTree({ name: input.library, version: input.version, skills: input.skills });
  if (!tree.ok) return refuse(tree.error.data.code, at(tree.error.data.path), tree.error.data.message);
  const files = tree.value;
  if (input.library === undefined) {
    const pkg: unknown = JSON.parse(files.get("package.json") ?? "{}");
    const deps =
      typeof pkg === "object" && pkg !== null
        ? [Reflect.get(pkg, "dependencies"), Reflect.get(pkg, "devDependencies")]
        : [];
    if (deps.some((d) => typeof d === "object" && d !== null && Object.hasOwn(d, name)))
      return refuse(
        "E1352",
        "package.json",
        `project name ${cut(name)} is a package the project lists; pass another --name`,
      );
  }
  const taken = new Set(listing.map((p) => p.replace(/\/$/, "")));
  // The folder's own README is kept: the project's is a guide, not a file the project needs (k.create Folder).
  if (input.existing === true && taken.has("README.md") && input.library === undefined) files.delete("README.md");
  const listed = listing.filter((p) => !p.endsWith("/"));
  const clashes = [
    ...new Set(
      sortedKeys(files.keys()).flatMap((p) => {
        const clash = taken.has(p) ? p : listed.find((f) => p.startsWith(`${f}/`));
        return clash === undefined ? [] : [clash];
      }),
    ),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const [first] = clashes;
  if (first !== undefined) {
    const one = clashes.length === 1;
    const message = one
      ? `${cut(first, 40)} exists; move it aside, or use a new folder`
      : `${clashes.length} files this writes exist; move them aside, or use a new folder`;
    const data: ScaffoldDiag = {
      kind: "diag",
      code: "E1361",
      path: at(first),
      ...AT,
      message,
      see: SEE,
      paths: clashes.map(at),
    };
    return err({ code: "scaffold.rejected", message: `E1361 ${message}`, data });
  }
  const records: CreateRecord[] = sortedKeys(files.keys()).map((path) => ({
    kind: "scaffold.edit",
    action: "create",
    path,
  }));
  if (member && !ws.member) {
    const warn: ScaffoldDiag = {
      kind: "diag",
      code: "W1364",
      path: "",
      ...AT,
      message: `${cut(folder, 40)} is not in the workspace's package globs; add it to them`,
      see: SEE,
    };
    records.push(warn);
  }
  const next = (command: string): CreateRecord => ({ kind: "create.next", command });
  if (folder !== ".") records.push(next(`cd ${shellPath(folder)}`));
  if (input.gitAbove !== true) records.push(next("git init -b main"));
  // The manager finds the workspace's root from any folder in it, so the install is printed as it is typed.
  records.push(next(m.install));
  const steps = input.library === undefined ? ["dev", "check", "test", "build"] : ["check", "test", "pack"];
  for (const s of steps) records.push(next(`${m.run} ${s}`));
  return ok({ files, records });
}
