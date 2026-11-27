import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathCollisions, serverOnlyCalls } from "@keel/compiler";
import { identityDiags } from "@keel/compiler/hosting/identityDiags";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { Diag } from "./Diag.ts";
import { VIEW } from "./VIEW.ts";
import { agentDrift } from "./agentDrift.ts";
import { asInstalled } from "./asInstalled.ts";
import { baseInput } from "./baseInput.ts";
import { codeFiles } from "./codeFiles.ts";
import { deployFreshness } from "./deployFreshness.ts";
import type { View } from "./derived/View.ts";
import type { Work } from "./derived/Work.ts";
import { frozenRun } from "./derived/frozenRun.ts";
import { evaluationDiag } from "./evaluationDiag.ts";
import { libraryManifestFiles } from "./libraryManifestFiles.ts";
import { loadShells } from "./loadShells.ts";
import { makeDiag } from "./makeDiag.ts";
import { ownLibrary } from "./ownLibrary.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectTopology } from "./projectTopology.ts";
import { relPath } from "./relPath.ts";
import { runCheck } from "./runCheck.ts";
import { shellPolicy } from "./shellPolicy.ts";
import { summary } from "./summary.ts";
import { viewDirs } from "./viewDirs.ts";

const readText = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/**
 * `keel check [paths]`: k.check diagnostics over the code files and `.keel/*.json` files under `paths`
 * (stdlib `deps` imported first, E1159, rfc:0066), then a summary that counts every code (`--code` filters display only).
 * Run over the disk (`Io.load`), it takes each project's derivation (k.derived Readers): the evaluated views
 * (`deriveEvaluated`, cached; its problems are diagnostics) reach the check, and the views are not read from disk.
 * Not frozen (`frozenRun`), it then writes each view and deploy file whose bytes differ (`refreshViews`; W1018 when one
 * cannot be written); frozen, it writes nothing and each differing view present is E1005. Given files only (no
 * `Io.load`), it writes nothing and the views among them are judged as `check()` judges them. The summary's
 * `counts` hold `refreshed`, `evaluated` and `cached` (k.derived Work). With `defer`, the refresh and the evaluation's
 * problem records are handed to the
 * caller instead of run (`keel build`, which writes nothing when its check fails).
 * `--base <surface.json>` hands the deployed surface to the k.compat pass (E1562); no usable surface there is W1568;
 * the file it names is never written.
 * E1559 (one path in two deployables) and E1558 (server-only route work a `client` or `static` deployable serves) come
 * from `pathCollisions` and `serverOnlyCalls`, the functions `keel build` calls; E1579 for a route under the identity
 * source's `handle.path`, from `identityDiags`. Each declared shell's target loads first (`shellTargets`: E1159, E1585),
 * and each plugin it names that `package.json` lacks is one E1572, once per plugin (k.shell Plugins).
 * W1356 for a stale agent file, where `AGENTS.md` holds the Keel block.
 * Run over every code file, it checks the files of the app's libraries too (`runCheck`, k.library In an app).
 * In a library's own folder (`ownLibrary`) it reads the folder as an app holds the library installed (`asInstalled`):
 * every k.library rule holds and E1162 does not; the libraries its manifest lists are read and imported as an app's
 * are, and each diagnostic is located at the folder's own path (k.library-pack Own folder).
 */
export async function checkCommand(
  input: Input,
  given: Io,
  defer?: (refresh: () => Diag[], problems: readonly Diag[]) => void,
): Promise<OutRecord[]> {
  const frozen = frozenRun(input.frozen, given.env);
  const work: Work = { evaluated: 0, cached: 0, refreshed: 0 };
  // A library's own folder is read as an app holds the library installed (k.library-pack Own folder).
  const own = ownLibrary(given.cwd);
  const view = own === undefined ? undefined : asInstalled(own.name, own.text, projectFiles(given));
  const io = view === undefined ? given : { ...given, files: view.files };
  const files = codeFiles(
    io,
    view === undefined ? input.paths : input.paths?.map((p) => view.to(relPath(io.cwd, p).replace(/\/+$/, ""))),
    true,
  );
  const base = baseInput(input, io);
  const project = projectFiles(io);
  // Without paths, or with paths that cover every code file, the app's libraries are checked too (k.library In an app).
  const whole = files.length === codeFiles(io, undefined, true).length;
  // In a library's own folder, the libraries its manifest lists are found and imported from it.
  const manifest = view === undefined ? undefined : project.find((f) => f.path === view.to("module.ts"));
  const reach = manifest === undefined ? project : [{ path: "modules/library/module.ts", source: manifest.source }];
  // Over the disk, each project's evaluated views are derived (k.derived Readers); a library's own folder keeps none.
  // `keel build` (`defer`) keeps the root project's views whether or not it has a `topology.ts` or a view yet.
  const found = given.load === undefined || view !== undefined ? [] : viewDirs(project);
  const dirs =
    defer === undefined || found.includes("") || view !== undefined || given.load === undefined
      ? found
      : ["", ...found];
  const derived: Record<string, Record<string, string>> = {};
  const problems: Diag[] = [];
  const holds: (() => boolean)[] = [];
  for (const dir of dirs) {
    const own = project.filter(
      (f) => f.path.startsWith(dir) && !dirs.some((d) => d.length > dir.length && f.path.startsWith(d)),
    );
    const rel = own.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const codes = rel.filter((f) => CODE_FILE.test(f.path)).map((f) => f.path);
    const ev = await (await import("@keel/cli/derive")).deriveEvaluated(join(io.cwd, dir), rel, codes, work);
    holds.push(ev.held);
    // Each problem line names its file (`evaluationDiag`); a project's path is project-relative.
    for (const line of ev.problems) {
      const d = evaluationDiag(line);
      const at = d.path === undefined || isAbsolute(d.path) ? d.path : `${dir}${d.path}`;
      problems.push(at === undefined ? d : { ...d, path: isAbsolute(at) ? relPath(io.cwd, at) : at });
    }
    if (ev.problems.length === 0) derived[dir] = { "routes.json": ev.routes, "surface.json": ev.surface };
  }
  // Not frozen, the views are the run's to write, so check does not judge them on disk; frozen, it compares them.
  const judged =
    dirs.length === 0 || frozen ? files : files.filter((f) => !dirs.includes(VIEW.exec(f.path)?.[1] ?? "\0"));
  const compiled = new Map<string, Readonly<Record<string, string | null>>>();
  const checked = [
    ...problems,
    ...(await runCheck(io.cwd, judged, project, base.value, whole, reach, {
      derived,
      dirs: frozen ? [] : dirs,
      out: compiled,
    })),
  ];
  const topology = projectTopology(project);
  const policy = await shellPolicy(io.cwd, project);
  const loaded = await loadShells(io.cwd, project, policy);
  // Deploy files are views too (k.deploy): rewritten when the run keeps views, else each differing one is E1005.
  const deployTree = [...project, ...libraryManifestFiles(io.cwd, project)];
  const deploy = deployFreshness(deployTree, policy, loaded.shells, frozen || dirs.length === 0);
  const paths = [
    ...identityDiags(project, io.cwd),
    ...(topology === undefined
      ? []
      : [...pathCollisions(project, topology, io.cwd), ...serverOnlyCalls(project, topology)]),
  ].map((d) => makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see }));
  const diags: Diag[] = [
    ...(base.warn === undefined ? [] : [base.warn]),
    ...checked,
    ...paths,
    ...loaded.diags,
    ...loaded.needs.filter((n, i, all) => all.findIndex((x) => x.plugin === n.plugin) === i).map((n) => n.diag),
    ...deploy.diags,
    ...(await agentDrift(project)),
  ];
  let created = 0;
  // The views written after judging (k.derived Refresh), unless an input changed during the run.
  if (!frozen && dirs.length > 0) {
    const views: View[] = [...deploy.views];
    // The file `--base` names is never rewritten, `.keel/surface.json` included (k.compat Base).
    const baseFile = input.base === undefined ? undefined : resolve(io.cwd, input.base);
    const kept = (v: View): boolean => resolve(io.cwd, v.path) !== baseFile;
    for (const dir of dirs) {
      const own = compiled.get(dir) ?? {};
      const ev = derived[dir];
      for (const [name, text] of Object.entries(own))
        if (typeof text === "string" && name !== "routes.json")
          views.push({ path: `${dir}.keel/${name}`, text, readonly: true });
      if (ev === undefined) continue;
      views.push({ path: `${dir}.keel/routes.json`, text: ev["routes.json"] ?? "", readonly: true });
      views.push({ path: `${dir}.keel/surface.json`, text: ev["surface.json"] ?? "", readonly: true });
    }
    const same = (): boolean =>
      holds.every((h) => h()) &&
      project.filter((f) => CODE_FILE.test(f.path)).every((f) => readText(join(io.cwd, f.path)) === f.source);
    const { refreshViews } = await import("@keel/cli/derive");
    const written = views.filter(kept);
    if (defer === undefined) {
      diags.push(...refreshViews(io.cwd, written, same, work));
      // A view the run wrote that its files did not hold counts as one of them, so the count is that of the tree
      // after the run, whichever run wrote the views first.
      const held = new Set(files.map((f) => f.path));
      const roots = (input.paths ?? [])
        .map((p) => relPath(io.cwd, p).replace(/\/+$/, ""))
        .filter((p) => p !== "" && p !== ".");
      const under = (p: string): boolean => roots.length === 0 || roots.some((r) => p === r || p.startsWith(`${r}/`));
      created = written.filter(
        (v) => VIEW.test(v.path) && !held.has(v.path) && under(v.path) && readText(join(io.cwd, v.path)) !== undefined,
      ).length;
    } else defer(() => refreshViews(io.cwd, written, same, work), problems);
  } else defer?.(() => [], problems);
  const errors = diags.filter((d) => d.code.startsWith("E")).length;
  const warnings = diags.filter((d) => d.code.startsWith("W")).length;
  const shown =
    view === undefined ? diags : diags.map((d) => (d.path === undefined ? d : { ...d, path: view.back(d.path) }));
  const { refreshed, evaluated, cached } = work;
  // `files` counts every file the run read, views included, and each view it created.
  const counted = files.length + created;
  return [...shown, summary("check", diags, { files: counted, refreshed, errors, warnings, evaluated, cached })];
}
