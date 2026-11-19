import path from "node:path";
import { artifactHashes, compile, parseTopology, projectDirs, routeLiterals } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import { mountDiags } from "@keel/compiler/hosting/mountDiags";
import { topologyReadProblems } from "@keel/compiler/hosting/topologyReadProblems";
import type { Checked } from "./internal/Checked.ts";
import type { Expected } from "./internal/Expected.ts";
import { apiWithoutServer } from "./internal/apiWithoutServer.ts";
import { artifactDir } from "./internal/artifactDir.ts";
import { budgetBreaches } from "./internal/budgetBreaches.ts";
import { compatChecks } from "./internal/compat/compatChecks.ts";
import { duplicateErrorCodes } from "./internal/duplicateErrorCodes.ts";
import { generatedEdits } from "./internal/generatedEdits.ts";
import { guardRedirectLoops } from "./internal/guardRedirectLoops.ts";
import { isCodePath } from "./internal/isCodePath.ts";
import { moduleChecks } from "./internal/modules/moduleChecks.ts";
import { normalize } from "./internal/normalize.ts";
import { parseFile } from "./internal/parseFile.ts";
import { prefixCollisions } from "./internal/prefixCollisions.ts";
import { ruleCodeDeclarations } from "./internal/ruleCodeDeclarations.ts";
import { runRules } from "./internal/runRules.ts";
import { summarize } from "./internal/summarize.ts";
import { topologyDiags } from "./internal/topologyDiags.ts";
import { topologyNeeds } from "./internal/topologyNeeds.ts";
import { typeCheck } from "./internal/typeCheck.ts";
import { rules } from "./rules.ts";
import type { CheckOptions } from "./types/CheckOptions.ts";
import type { CheckResult } from "./types/CheckResult.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";

/** The topology of the project at `dir`: the caller's for the root, else the static parse of `<dir>topology.ts`. */
function topologyOf(dir: string, all: readonly SourceFile[], opts: CheckOptions): Topology | undefined {
  if (dir === "") return opts.topology;
  const manifest = all.find((f) => f.path === `${dir}topology.ts`);
  return manifest && parseTopology(manifest.source).topology;
}

/**
 * The topology E1562 compares callers by (k.compat Base): with `<dir>topology.ts` present but unreadable (E1552), none
 * (`{}`), so every caller and route count as split; else `topologyOf`.
 */
function compatTopology(dir: string, all: readonly SourceFile[], opts: CheckOptions): Topology | undefined {
  const source = all.find((f) => f.path === `${dir}topology.ts`)?.source;
  const unreadable = source !== undefined && topologyReadProblems(source).some(([code]) => code === "E1552");
  return unreadable ? {} : topologyOf(dir, all, opts);
}

/**
 * What E1005 compares each checked `.keel/` dir's artifacts with, keyed by the dir of the project holding it (`""` for
 * the root, else `apps/a/`): the hashes the compiler derives from the sources under that dir in `opts.project`
 * (default `files`), paths made relative to it, with its own `topology.ts` (rfc:0050, rfc:0055), and, when
 * `routes.json` is evaluated, the literals of its `routes.ts` (rfc:0059). One compile per project with a checked
 * artifact; nothing the caller passes replaces the derivation (backlog 0143).
 */
function expectedHashes(files: readonly SourceFile[], opts: CheckOptions): ReadonlyMap<string, Expected> {
  const out = new Map<string, Expected>();
  const project = opts.project ?? files;
  const dirs = projectDirs(project);
  /** A file under `dir` that a deeper project holds is that project's, not `dir`'s (as `keel build` compiles it). */
  const deeper = (dir: string, path: string): boolean =>
    dirs.some((d) => d.length > dir.length && d.startsWith(dir) && path.startsWith(d));
  for (const file of files) {
    const dir = artifactDir(file.path);
    if (dir === undefined || out.has(dir)) continue;
    const sources = project
      .filter((f) => f.path.startsWith(dir) && !deeper(dir, f.path))
      .map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const topology = topologyOf(dir, project, opts);
    const options = topology === undefined ? {} : { topology };
    const hashes = artifactHashes(sources, options);
    // Packages a route manifest spreads resolve from the project's own directory, as its imports do.
    const literal = { ...options, root: path.join(opts.root ?? process.cwd(), dir) };
    out.set(dir, hashes["routes.json"] === null ? { hashes, routes: routeLiterals(sources, literal) } : { hashes });
  }
  return out;
}

/**
 * `keel check` over in-memory files (k.check pipeline): (1) oxc parse and strict TS check, (2) compiler
 * diagnostics passed through unchanged, one compile per project (`projectDirs`: paths relative to it, its own
 * `topology.ts`; rfc:0059), (3) the rule registry on each file plus project passes (E1005
 * against the hashes the compiler derives from each artifact's project, W1005, E1454, E1508, E1511, E1566, E1580-E1582, E1584, E1753, E1755, the k.module pass
 * E1151-E1157, and the k.compat pass E1561-E1562 over `.keel/surface.json`), (4) dedupe and sort. Static only: no app code is evaluated (rendered a11y is `keel test`, rfc:0023). Pure and deterministic for equal inputs.
 */
export function check(files: readonly SourceFile[], opts: CheckOptions = {}): CheckResult {
  const code = files.filter((f) => isCodePath(f.path));
  // One compile per project, with its paths and topology, so a workspace root sees what the app sees (rfc:0059).
  const all = opts.project === undefined ? files : [...files, ...opts.project];
  const dirs = projectDirs(all);
  const out: Diagnostic[] = [];
  const reported = new Map<string, Set<string>>();
  const artifactsOf = new Map<string, Readonly<Record<string, unknown>>>();
  // The project a rule sees beside its own file (rfc:0070): one array per project, shared by reference.
  const projectOf = new Map<string, readonly SourceFile[]>();
  for (const dir of dirs) {
    const group = code.filter((f) => dirs.find((d) => f.path.startsWith(d)) === dir);
    if (group.length === 0) continue;
    // Every code file of the project, its `topology.ts` included: a checked file's text first, then `opts.project`'s.
    const members = new Map<string, SourceFile>();
    for (const f of all)
      if (isCodePath(f.path) && !members.has(f.path) && dirs.find((d) => f.path.startsWith(d)) === dir)
        members.set(f.path, f);
    const project = Object.freeze([...members.values()]);
    for (const f of group) projectOf.set(f.path, project);
    const topology = topologyOf(dir, all, opts);
    const sources = group.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const top = all.find((f) => f.path === `${dir}topology.ts`)?.source;
    // E1004 reads placement from the project's own `topology.ts` when the caller passes none (k.boundary Reach).
    const placed = topology ?? (top === undefined ? undefined : parseTopology(top).topology);
    const compiled = compile(sources, placed === undefined ? {} : { topology: placed });
    if (topology !== undefined) {
      const evaluated = all.find((f) => f.path === `${dir}.keel/routes.json`)?.source;
      out.push(...apiWithoutServer(dir, sources, topology, path.join(opts.root ?? process.cwd(), dir), top, evaluated));
    }
    // E1552, E1566, E1572, E1573: the caller's topology, else the static read of `topology.ts`, beside the project's
    // `package.json`.
    const needs = topology ?? (top === undefined ? undefined : parseTopology(top).topology);
    const pkg = all.find((f) => f.path === `${dir}package.json`)?.source;
    if (needs !== undefined) out.push(...topologyDiags(dir, needs, top), ...topologyNeeds(dir, needs, top ?? "", pkg));
    // E1580-E1582, E1584 (k.mount): the project's `identity.ts`, its importers and the topology serving them.
    for (const d of mountDiags(project.map((f) => ({ path: f.path.slice(dir.length), source: f.source }))))
      out.push({ kind: "diag", ...d, path: `${dir}${d.path}` });
    for (const d of compiled.diagnostics) {
      const path = d.path === "" ? d.path : `${dir}${d.path}`;
      out.push({ kind: "diag", ...d, path });
      reported.set(path, (reported.get(path) ?? new Set()).add(d.code));
    }
    for (const f of group) artifactsOf.set(f.path, { ...compiled.artifacts, ...opts.artifacts });
  }

  const typed = opts.types === false ? undefined : typeCheck(code, opts.root ?? process.cwd(), reported);
  // One diagnostic per fault: where the compiler reports E1403 at an expression, E1406 does not.
  const e1403 = new Set(out.filter((d) => d.code === "E1403").map((d) => `${d.path}:${d.line}:${d.col}`));
  if (typed !== undefined)
    out.push(...typed.diagnostics.filter((d) => d.code !== "E1406" || !e1403.has(`${d.path}:${d.line}:${d.col}`)));

  const registered = rules();
  const checked: Checked[] = [];
  for (const file of code) {
    const parsed = parseFile(file);
    if (!parsed.ok) continue;
    checked.push({ file, parsed });
    const artifacts = artifactsOf.get(file.path) ?? { ...opts.artifacts };
    const project = projectOf.get(file.path) ?? [file];
    const dates = typed?.dates.get(file.path) ?? (typed === undefined ? undefined : new Set<number>());
    const input = { file, ast: parsed.program, artifacts, project };
    out.push(...runRules(registered, dates === undefined ? input : { ...input, dates }));
  }
  out.push(
    ...duplicateErrorCodes(checked),
    ...moduleChecks(checked),
    ...guardRedirectLoops(checked),
    ...prefixCollisions(checked),
    ...ruleCodeDeclarations(checked),
    ...budgetBreaches(opts.budgets ?? []),
    ...generatedEdits(files, expectedHashes(files, opts), opts.project ?? files),
    ...compatChecks(files, opts.project ?? files, (dir) => compatTopology(dir, all, opts), opts.base),
  );

  const diagnostics = normalize(out);
  return { diagnostics, summary: summarize(diagnostics) };
}
