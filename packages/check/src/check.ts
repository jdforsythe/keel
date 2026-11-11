import path from "node:path";
import { artifactHashes, compile, parseTopology, projectDirs, routeLiterals } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
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
 * against the hashes the compiler derives from each artifact's project, W1005, E1454, E1508, E1511, E1753, E1755, the k.module pass
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
    const manifest = group.some((f) => f.path === `${dir}topology.ts`)
      ? undefined
      : all.find((f) => f.path === `${dir}topology.ts`);
    const project = Object.freeze(manifest === undefined ? group : [...group, manifest]);
    for (const f of group) projectOf.set(f.path, project);
    const topology = topologyOf(dir, all, opts);
    const sources = group.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const compiled = compile(sources, topology === undefined ? {} : { topology });
    const top = all.find((f) => f.path === `${dir}topology.ts`)?.source;
    if (topology !== undefined) {
      const evaluated = all.find((f) => f.path === `${dir}.keel/routes.json`)?.source;
      out.push(...apiWithoutServer(dir, sources, topology, path.join(opts.root ?? process.cwd(), dir), top, evaluated));
    }
    for (const d of compiled.diagnostics) {
      const path = d.path === "" ? d.path : `${dir}${d.path}`;
      out.push({ kind: "diag", ...d, path });
      reported.set(path, (reported.get(path) ?? new Set()).add(d.code));
    }
    for (const f of group) artifactsOf.set(f.path, { ...compiled.artifacts, ...opts.artifacts });
  }

  if (opts.types !== false) out.push(...typeCheck(code, opts.root ?? process.cwd(), reported));

  const registered = rules();
  const checked: Checked[] = [];
  for (const file of code) {
    const parsed = parseFile(file);
    if (!parsed.ok) continue;
    checked.push({ file, parsed });
    const artifacts = artifactsOf.get(file.path) ?? { ...opts.artifacts };
    const project = projectOf.get(file.path) ?? [file];
    out.push(...runRules(registered, { file, ast: parsed.program, artifacts, project }));
  }
  out.push(
    ...duplicateErrorCodes(checked),
    ...moduleChecks(checked),
    ...guardRedirectLoops(checked),
    ...prefixCollisions(checked),
    ...ruleCodeDeclarations(checked),
    ...budgetBreaches(opts.budgets ?? []),
    ...generatedEdits(files, expectedHashes(files, opts), opts.project ?? files),
    ...compatChecks(files, opts.project ?? files, (dir) => topologyOf(dir, all, opts), opts.base),
  );

  const diagnostics = normalize(out);
  return { diagnostics, summary: summarize(diagnostics) };
}
