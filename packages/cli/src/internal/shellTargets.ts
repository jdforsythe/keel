import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { dependencyNeed } from "@keel/check";
import type { Origins, Topology } from "@keel/compiler";
import type { DeployShells, ShellApp } from "@keel/scaffold";
import { linkEscapes } from "@keel/scaffold/links";
import type { ShellTarget } from "../types/ShellTarget.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectTopology } from "./projectTopology.ts";
import { shellSlot } from "./shellSlot.ts";
import { shellsOf } from "./shellsOf.ts";

type Shell = "capacitor" | "tauri";
/** A shell file path that leaves its folder: a `..` segment, a `\` or a leading `/` (k.shell Files). */
const outside = (p: string): boolean => p.startsWith("/") || p.includes("\\") || p.split("/").includes("..");
/** The real path of `cwd`, else `cwd` resolved. */
function realOf(cwd: string): string {
  try {
    return realpathSync(cwd);
  } catch {
    return resolve(cwd);
  }
}

/** A string field of `package.json` text, else undefined. */
function field(text: string | undefined, key: string): string | undefined {
  try {
    const v: unknown = Reflect.get(Object(JSON.parse(text ?? "null")), key);
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** One import at a time, so each registration is held for the file being imported. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Import `@keel/std-<shell>/tools` as the project at `cwd` resolves it: the file once it has loaded (its targets are
 * `shellSlot.byFile`'s entry), else the code and why not (a second registration of one shell: E1053).
 */
async function load(
  cwd: string,
  shell: Shell,
): Promise<{ readonly file: string } | { readonly code: "E1159" | "E1053"; readonly why: string }> {
  let file: string;
  try {
    file = createRequire(join(cwd, "package.json")).resolve(`@keel/std-${shell}/tools`);
  } catch {
    return { code: "E1159", why: "not found" };
  }
  const run = queue.then(async () => {
    shellSlot.loading = file;
    try {
      await import(pathToFileURL(file).href);
      return { file };
    } catch (e) {
      return e instanceof Error && e.message.startsWith("E1053")
        ? { code: "E1053" as const, why: "registers its target twice" }
        : { code: "E1159" as const, why: "throws on import" };
    } finally {
      shellSlot.loading = "";
    }
  });
  queue = run;
  return run;
}

/**
 * Binary only: the shell targets of the project at `cwd` (k.shell Shell target). For each shell `shellsOf` lists (declared
 * by a `client` deployable of the root `topology.ts`, or holding files to remove), the shell package's `./tools` entry
 * is imported (once per process, one at a time), which registers its target (`shellTarget`), held for that file: the
 * project reads the target its own root resolves. For a declared shell, an entry that does not import is E1159, one
 * registering a shell twice E1053, a package registering no target E1585, and a target whose `files` give a path
 * outside the shell's folder one E1585: by its text, or because a link carries it out of the folder's real path
 * (`linkEscapes`, k.scaffold Links). `shells` are the targets as the deploy generator reads
 * them, giving no file of a set holding such a path; `apps` each declared shell's app, holding `policy` for its deployable's declared
 * origins (k.origins); `paths`
 * the shell files they give; `topology` the parsed root `topology.ts`; `needs` the E1572 of each plugin a target's
 * `plugins` names for an app that the project's `package.json` `dependencies` lack or hold at another version text
 * (k.shell Plugins), at the first deployable asking, once per shell and plugin, in order; none without a
 * `package.json` that is a JSON object.
 */
export async function shellTargets(
  cwd: string,
  project: readonly SourceFile[],
  policy: ((origins?: Origins) => string) | undefined,
): Promise<{
  readonly targets: Readonly<Partial<Record<Shell, ShellTarget>>>;
  readonly shells: DeployShells;
  readonly apps: readonly { readonly shell: Shell; readonly app: ShellApp }[];
  readonly paths: ReadonlySet<string>;
  readonly topology: Topology;
  readonly needs: readonly { readonly shell: Shell; readonly plugin: string; readonly diag: Diag }[];
  readonly diags: Diag[];
}> {
  const pkg = project.find((f) => f.path === "package.json")?.source;
  const shared = {
    version: field(pkg, "version") ?? "0.0.0",
    pkg: field(pkg, "name") ?? "",
    policy,
    identity: project.some((f) => f.path === "identity.ts"),
  };
  const topology = projectTopology(project) ?? {};
  const targets: Partial<Record<Shell, ShellTarget>> = {};
  const shells: { -readonly [S in Shell]?: DeployShells[S] } = {};
  const diags: Diag[] = [];
  const needs: { shell: Shell; plugin: string; diag: Diag }[] = [];
  const source = project.find((f) => f.path === "topology.ts")?.source ?? "";
  const all: { shell: Shell; app: ShellApp }[] = [];
  const at = { path: "topology.ts", line: 1, col: 1 };
  const real = realOf(cwd);
  for (const { shell, declared } of shellsOf(project)) {
    const loaded = await load(cwd, shell);
    if (!("file" in loaded)) {
      if (declared.length > 0)
        diags.push(
          loaded.code === "E1053"
            ? makeDiag("E1053", `shell package @keel/std-${shell}/tools ${loaded.why}`, { ...at, see: "k.cli" })
            : makeDiag("E1159", `shell package @keel/std-${shell}/tools cannot be imported (${loaded.why})`, {
                ...at,
                see: "k.module",
              }),
        );
      continue;
    }
    const target = shellSlot.byFile.get(loaded.file)?.get(shell);
    if (target === undefined) {
      if (declared.length > 0)
        diags.push(makeDiag("E1585", `@keel/std-${shell}/tools registers no shell target`, { ...at, see: "k.shell" }));
      continue;
    }
    targets[shell] = target;
    const apps: ShellApp[] = declared.flatMap((deployable) => {
      const s = topology[deployable]?.shells?.[shell];
      return s === undefined
        ? []
        : [{ deployable, id: s.id, name: s.name, ...shared, policy: policy?.(topology[deployable]?.origins) }];
    });
    for (const app of apps) all.push({ shell, app });
    for (const app of apps)
      for (const { plugin, version, need } of target.plugins(app)) {
        if (pkg === undefined || needs.some((n) => n.shell === shell && n.plugin === plugin)) continue;
        const message = `${app.deployable}: ${shell} needs ${plugin}`;
        const at = { dir: "", source, pkg, deployable: app.deployable, dep: plugin, message, version, need };
        const diag = dependencyNeed(at);
        if (diag !== undefined) needs.push({ shell, plugin, diag });
      }
    // The first path of `app`'s set that leaves its folder, by its text or through a symlink on disk.
    const leaves = (app: ShellApp, given: Readonly<Record<string, string>>): string | undefined => {
      const folder = join("deploy", app.deployable, shell);
      return Object.keys(given).find(
        (p) => outside(p) || linkEscapes(join(real, folder), join(resolve(cwd), folder, p)),
      );
    };
    const bad = apps.map((app) => leaves(app, target.files(app))).find((p) => p !== undefined);
    if (bad !== undefined)
      diags.push(
        makeDiag("E1585", `shell file ${bad.slice(0, 32)} is outside deploy/<name>/${shell}/`, {
          ...at,
          see: "k.shell",
        }),
      );
    shells[shell] = {
      files: (app) => {
        const given = target.files(app);
        return leaves(app, given) === undefined ? given : {};
      },
      ci: target.ci,
    };
  }
  const paths = new Set(
    all.flatMap(({ shell, app }) =>
      Object.keys(shells[shell]?.files(app) ?? {}).map((p) => `deploy/${app.deployable}/${shell}/${p}`),
    ),
  );
  return { targets, shells, apps: all, paths, topology, needs, diags };
}
