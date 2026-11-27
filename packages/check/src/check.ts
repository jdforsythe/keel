import path from "node:path";
import { artifactHashes, compile, parseTopology, projectDirs, routeLiterals } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import { foreignRoutesDiags } from "@keel/compiler/hosting/foreignRoutesDiags";
import { mountDiags } from "@keel/compiler/hosting/mountDiags";
import { servedByEdit } from "@keel/compiler/hosting/servedByEdit";
import { topologyReadProblems } from "@keel/compiler/hosting/topologyReadProblems";
import { hashOf } from "@keel/compiler/internal";
import type { Checked } from "./internal/Checked.ts";
import type { Expected } from "./internal/Expected.ts";
import { aliasedImports } from "./internal/aliasedImports.ts";
import { apiWithoutServer } from "./internal/apiWithoutServer.ts";
import { applyEdits } from "./internal/applyEdits.ts";
import { artifactDir } from "./internal/artifactDir.ts";
import { budgetBreaches } from "./internal/budgetBreaches.ts";
import { chainStoreIds } from "./internal/chainStoreIds.ts";
import { compatChecks } from "./internal/compat/compatChecks.ts";
import { contractChecks } from "./internal/contractChecks.ts";
import { depsRuleOwners } from "./internal/depsRuleOwners.ts";
import { dropLifted } from "./internal/dropLifted.ts";
import { duplicateErrorCodes } from "./internal/duplicateErrorCodes.ts";
import { generatedEdits } from "./internal/generatedEdits.ts";
import { guardRedirectLoops } from "./internal/guardRedirectLoops.ts";
import { indexHtmlDiag } from "./internal/indexHtmlDiag.ts";
import { isCodePath } from "./internal/isCodePath.ts";
import { isSqlPath } from "./internal/isSqlPath.ts";
import { libraryFolders } from "./internal/libraryFolders.ts";
import { libraryIds } from "./internal/libraryIds.ts";
import { libraryImports } from "./internal/libraryImports.ts";
import { looksDiags } from "./internal/looks/looksDiags.ts";
import { looksOf } from "./internal/looks/looksOf.ts";
import { projectLooks } from "./internal/looks/projectLooks.ts";
import { libraryLedgers } from "./internal/modules/libraryLedgers.ts";
import { moduleChecks } from "./internal/modules/moduleChecks.ts";
import { normalize } from "./internal/normalize.ts";
import { outsideImports } from "./internal/outsideImports.ts";
import { parseFile } from "./internal/parseFile.ts";
import { placedWithoutRoutes } from "./internal/placedWithoutRoutes.ts";
import { projectLibraries } from "./internal/projectLibraries.ts";
import { workspaceLibraries } from "./internal/workspaceLibraries.ts";
import { projectRoots } from "./internal/projectRoots.ts";
import { reachResolve } from "./internal/reachResolve.ts";
import { registerNames } from "./internal/registerNames.ts";
import { ruleCodeDeclarations } from "./internal/ruleCodeDeclarations.ts";
import { ruleInScope } from "./internal/ruleInScope.ts";
import { ruleOwners } from "./internal/ruleOwners.ts";
import { runRules } from "./internal/runRules.ts";
import { runSqlRules } from "./internal/runSqlRules.ts";
import { schemesIn } from "./internal/schemesIn.ts";
import { stdInScope } from "./internal/stdInScope.ts";
import { stylesDiags } from "./internal/stylesDiags.ts";
import { summarize } from "./internal/summarize.ts";
import { topologyDiags } from "./internal/topologyDiags.ts";
import { topologyNeeds } from "./internal/topologyNeeds.ts";
import { twoCopies } from "./internal/twoCopies.ts";
import { typeCheck } from "./internal/typeCheck.ts";
import { typeReferences } from "./internal/typeReferences.ts";
import { unifiedDiff } from "./internal/unifiedDiff.ts";
import { unknownModules } from "./internal/unknownModules.ts";
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
 * `routes.json` is evaluated, the literals of its contracts and bindings. One compile per project with a checked
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
    const compiled = artifactHashes(sources, options);
    // `schemes.json` (k.schemes) is derived from the evaluated tokens: with no `tokens.ts`, one scheme.
    const tokens: unknown = opts.artifacts?.tokens ?? opts.projectArtifacts?.[dir]?.tokens;
    const hasTokens = project.some((f) => f.path === `${dir}tokens.ts`);
    const schemes = tokens !== undefined ? schemesIn(tokens) : hasTokens ? undefined : ["light"];
    const hashes =
      schemes === undefined ? compiled : { ...compiled, "schemes.json": hashOf({ schemes: [...schemes] }) };
    // Packages a route manifest spreads resolve from the project's own directory, as its imports do.
    const literal = { ...options, root: path.join(opts.root ?? process.cwd(), dir) };
    out.set(dir, hashes["routes.json"] === null ? { hashes, routes: routeLiterals(sources, literal) } : { hashes });
  }
  return out;
}

/**
 * `keel check` over in-memory files (k.check pipeline): (1) oxc parse and strict TS check, (2) compiler
 * diagnostics passed through unchanged, one compile per project (`projectDirs`: paths relative to it, its own
 * `topology.ts`; rfc:0059), (3) the rule registry on each code file, rules' `sql` readers on each migration, plus project passes (E1005
 * against the hashes the compiler derives from each artifact's project, W1005, E1454, E1607, E1550, E1508, E1511, E1566, E1586, E1587, W1012, E1580-E1582, E1584, E1589, E1592, E1753, E1755, E1765, the k.module pass
 * E1151-E1158, E1013, the contract passes (E1155, E1502-E1504, E1509, E1513, E1514), and the k.compat pass E1562, E1563,
 * W1564, W1568 over `.keel/surface.json`), (4) dedupe and sort. Static only: no app code is evaluated (rendered a11y is `keel test`, rfc:0023). Pure and deterministic for equal inputs.
 *
 * A library's files among the files (k.library In an app, `libraryFolders`) are read by every step at
 * `modules/<id>/<f>` but the type pass, the k.module pass and E1013, which read them where they lie; each diagnostic in
 * one is located at `node_modules/<name>/<f>` with no fix. E1161 and E1163's import half judge them there; E1106 reports
 * in none of them.
 */
export function check(input: readonly SourceFile[], inputOptions: CheckOptions = {}): CheckResult {
  // A library of the project's own tree is read once: through `node_modules/<name>/` when the project lists it, else
  // where it lies, as a library's file (k.library Kind).
  const ws = workspaceLibraries(inputOptions.project === undefined ? input : [...input, ...inputOptions.project]);
  const given = input.filter((f) => !ws.twin(f.path));
  const options: CheckOptions =
    inputOptions.project === undefined
      ? inputOptions
      : { ...inputOptions, project: inputOptions.project.filter((f) => !ws.twin(f.path)) };
  const realAll = options.project === undefined ? given : [...given, ...options.project];
  const libs = libraryFolders(realAll);
  const isLibrary = (p: string): boolean => libs.folder(p) !== undefined || ws.inPlace(p);
  // Each library's folder (`<p>node_modules/<name>/`): where the k.module pass finds it, and its files' view.
  const libraryRoots = new Set(libs.packages.map((f) => f.path.slice(0, -"package.json".length)));
  const viewed = (f: SourceFile): SourceFile => {
    const v = libs.view(f.path);
    return v === f.path ? f : { path: v, source: f.source };
  };
  const files = given.map(viewed);
  const opts: CheckOptions =
    options.project === undefined ? options : { ...options, project: options.project.map(viewed) };
  const realCode = given.filter((f) => isCodePath(f.path));
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
    projectRoots.set(project, path.resolve(opts.root ?? process.cwd()));
    for (const f of group) projectOf.set(f.path, project);
    // The rules that follow the client's reach follow an import of a library into its files (k.library In an app).
    const libraryFiles = new Set([...members.keys()].filter((p) => libs.folder(libs.real(p)) !== undefined));
    const inPlace = new Set([...members.keys()].filter((p) => ws.inPlace(p)));
    projectLibraries.set(project, { entries: libs.entries, files: libraryFiles, inPlace });
    const topology = topologyOf(dir, all, opts);
    const sources = group.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const top = all.find((f) => f.path === `${dir}topology.ts`)?.source;
    // E1004 reads placement from the project's own `topology.ts` when the caller passes none (k.boundary Reach).
    const placed = topology ?? (top === undefined ? undefined : parseTopology(top).topology);
    const resolve = reachResolve(project, dir, new Set(sources.map((f) => f.path)));
    const compiled = compile(sources, placed === undefined ? { resolve } : { topology: placed, resolve });
    if (topology !== undefined) {
      const evaluated = all.find((f) => f.path === `${dir}.keel/routes.json`)?.source;
      out.push(...apiWithoutServer(dir, sources, topology, path.join(opts.root ?? process.cwd(), dir), top, evaluated));
    }
    // E1552, E1566, E1572, E1573: the caller's topology, else the static read of `topology.ts`, beside the project's
    // `package.json`.
    const needs = topology ?? (top === undefined ? undefined : parseTopology(top).topology);
    const pkg = all.find((f) => f.path === `${dir}package.json`)?.source;
    if (needs !== undefined) out.push(...topologyDiags(dir, needs, top), ...topologyNeeds(dir, needs, top ?? "", pkg));
    // E1586: a placed stdlib module whose package resolves `./contract` and no `./routes`; E1552: a module unknown to
    // the project; each at its id in `topology.ts`.
    if (needs !== undefined && top !== undefined) {
      const own = project.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
      const at = path.join(opts.root ?? process.cwd(), dir);
      out.push(...placedWithoutRoutes(dir, needs, top, own, at), ...unknownModules(dir, needs, top, own, at));
    }
    // E1587: a `styles` entry that is no string literal or no package `.css` export; W1012: an `index.html` Keel never reads.
    if (top !== undefined) out.push(...stylesDiags(dir, top, path.join(opts.root ?? process.cwd(), dir)));
    if (all.some((f) => f.path === `${dir}index.html`)) out.push(indexHtmlDiag(dir));
    // E1580-E1582, E1584, E1589 (k.mount): the project's `identity.ts`, its importers and the topology serving them.
    for (const d of mountDiags(project.map((f) => ({ path: f.path.slice(dir.length), source: f.source })))) {
      // E1589's fix: `servedBy` of the one `node` deployable, for a `client` one (k.mount Messages).
      const edit =
        d.code === "E1589" && d.message.includes(" (client) ") && top !== undefined
          ? servedByEdit(top, d.message.split(" ")[0] ?? "")
          : undefined;
      const fix =
        edit === undefined || top === undefined
          ? {}
          : { fix: unifiedDiff(`${dir}topology.ts`, top, applyEdits(top, [edit])) };
      out.push({ kind: "diag", ...d, ...fix, path: `${dir}${d.path}` });
    }
    // E1592 (k.user): `identity.server.ts` and the project files it imports, importing the routes of a module another origin serves.
    for (const d of foreignRoutesDiags(
      project.map((f) => ({ path: f.path.slice(dir.length), source: f.source })),
      path.join(opts.root ?? process.cwd(), dir),
    ))
      out.push({ kind: "diag", ...d, path: `${dir}${d.path}` });
    for (const d of compiled.diagnostics) {
      const path = d.path === "" ? d.path : `${dir}${d.path}`;
      out.push({ kind: "diag", ...d, path });
      reported.set(path, (reported.get(path) ?? new Set()).add(d.code));
    }
    const own = opts.projectArtifacts?.[dir];
    const artifacts = { ...compiled.artifacts, ...own, ...opts.artifacts };
    for (const f of group) artifactsOf.set(f.path, artifacts);
    // k.looks: the libraries' shipped tokens read as text, judged against the tokens the project is given.
    const looks = looksOf(realAll, dir);
    projectLooks.set(project, {
      libraryOf: (p) => looks.libraryOf(libs.real(p)),
      ownSchemes: [
        ...(looks.own?.shipped?.value.color === undefined ? [] : Object.values(Object(looks.own.shipped.value.color))),
      ].some((v) => typeof v === "object" && v !== null)
        ? ["light", "dark"]
        : undefined,
      lookLibrary: (look) => {
        // A library's look by the `look` group's keys alone (k.a11y-static Library contrast).
        const lib = looks.listed.find((l) => !l.own && l.shipped?.names.get("look")?.includes(look) === true);
        return lib?.id;
      },
      libraryFileOf: (p) => {
        const lib = looks.libraryOf(libs.real(p));
        return lib === undefined || lib.own ? undefined : lib.id;
      },
      ships: (name) => looks.listed.some((l) => [...(l.shipped?.names.values() ?? [])].some((n) => n.includes(name))),
      shippedLook: (look) => {
        const lib = looks.listed.find((l) => l.shipped?.names.get("look")?.includes(look) === true);
        const at = lib?.shipped?.keys.get(`look\u0000${look}`);
        return lib === undefined || at === undefined ? undefined : { path: libs.view(lib.shippedPath), at };
      },
    });
    const tokens: unknown = Reflect.get(artifacts, "tokens");
    out.push(...looksDiags(looks, realAll, { given: tokens !== undefined, value: tokens }));
  }

  // The `@keel/*` packages this call's app manifests reach: a std package's formats apply only among them, and so do
  // the rules of one `importDeps` imported first, whatever an earlier call in this process loaded (k.check-cache).
  const scope = stdInScope(all, opts.root ?? process.cwd());
  const skip = new Map([...reported].map(([p, codes]) => [libs.real(p), codes]));
  const typed =
    opts.types === false
      ? undefined
      : typeCheck(given, opts.root ?? process.cwd(), skip, scope, opts.typeCache, isLibrary, libs.packages);
  // E1016's directive half is textual: it holds with the type pass off too (k.boundary Ambient types).
  out.push(...typeReferences(files));
  // One diagnostic per fault: where the compiler reports E1403 at an expression, E1406 does not.
  const e1403 = new Set(out.filter((d) => d.code === "E1403").map((d) => `${d.path}:${d.line}:${d.col}`));
  if (typed !== undefined)
    out.push(...typed.diagnostics.filter((d) => d.code !== "E1406" || !e1403.has(`${d.path}:${d.line}:${d.col}`)));

  const registered = rules().filter((r) => ruleInScope(ruleOwners.get(r.code), scope, depsRuleOwners));
  const checked: Checked[] = [];
  for (const file of code) {
    const parsed = parseFile(file);
    if (!parsed.ok) continue;
    checked.push({ file, parsed });
    const artifacts = artifactsOf.get(file.path) ?? { ...opts.artifacts };
    const project = projectOf.get(file.path) ?? [file];
    const dates = typed?.dates.get(libs.real(file.path)) ?? (typed === undefined ? undefined : new Set<number>());
    const input = { file, ast: parsed.program, artifacts, project };
    // One by one: a file may give more findings than a spread call takes arguments.
    const selects = typed?.schemeSelects.get(libs.real(file.path));
    const throws = typed?.keelThrows.get(libs.real(file.path)) ?? new Set<number>();
    const typedInput =
      dates === undefined
        ? input
        : { ...input, dates, types: true, schemeSelects: selects ?? new Set<number>(), keelThrows: throws };
    for (const d of runRules(registered, typedInput)) out.push(d);
  }
  for (const file of files) if (isSqlPath(file.path)) out.push(...runSqlRules(registered, file));
  // The passes that read a library's files where they lie.
  // A file that is no library's keeps its object: the readers that follow names key on it.
  const realChecked = checked.map((c) => {
    const at = libs.real(c.file.path);
    return at === c.file.path ? c : { file: { path: at, source: c.file.source }, parsed: c.parsed };
  });
  out.push(
    ...duplicateErrorCodes(checked),
    ...registerNames(checked, dirs, { entries: libs.entries, isLibrary: (p) => libs.real(p) !== p }),
    ...chainStoreIds(checked, dirs, all),
    ...moduleChecks(realChecked, realAll, (p) => projectOf.get(p) ?? [], {
      checked,
      root: (m) =>
        libraryRoots.has(m.root) ? m.root.replace(/node_modules\/[^/]+\/[^/]+\/$/, `modules/${m.prefix}/`) : m.root,
    }),
    ...libraryLedgers(realChecked, realAll, opts.root ?? process.cwd()),
    ...aliasedImports(realChecked, path.resolve(opts.root ?? process.cwd()), dirs, isLibrary),
    ...outsideImports(checked, path.resolve(opts.root ?? process.cwd()), dirs),
    ...libraryIds(realChecked, isLibrary, new Map([...libs.entries].map(([spec, at]) => [spec, libs.real(at)]))),
    ...libraryImports(realChecked, libs.folder),
    ...guardRedirectLoops(checked),
    ...contractChecks(checked, all, opts.topology),
    ...ruleCodeDeclarations(checked),
    ...budgetBreaches(opts.budgets ?? []),
    // E1005 derives each artifact from the files that wrote it: the app's sources and its libraries' at `modules/<id>/<f>`.
    ...generatedEdits(files, expectedHashes(files, opts), opts.project ?? files),
    ...compatChecks(files, opts.project ?? files, (dir) => compatTopology(dir, all, opts), opts.base),
    // E1765 (k.realm One copy): a kernel package each project's dependencies reach in two folders.
    ...[...new Set(["", ...dirs])].flatMap((dir) => twoCopies(dir, realAll, options.root)),
  );

  // A diagnostic in a library file is located where the file lies and carries no fix (k.library In an app).
  // E1106 alone reads a library's file as the library's: `s.format` is what a library declares (k.formats Who declares).
  const located = out
    .filter((d) => d.code !== "E1106" || !isLibrary(libs.real(d.path)))
    .map((d): Diagnostic => {
      const at = libs.real(d.path);
      if (!isLibrary(at)) return d;
      const { kind, code, line, col, message, see } = d;
      return { kind, code, path: at, line, col, message, ...(see === undefined ? {} : { see }) };
    });
  // A lifted range (k.check, App code) reports none of its codes.
  const diagnostics = normalize(dropLifted(located, realCode));
  return { diagnostics, summary: summarize(diagnostics) };
}
