import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Annotated } from "./Annotated.ts";
import { CACHE_FORMAT } from "./CACHE_FORMAT.ts";
import type { FormatSite } from "./FormatSite.ts";
import { NESTED_RESULT_MESSAGE } from "./NESTED_RESULT_MESSAGE.ts";
import type { TypeEntry } from "./TypeEntry.ts";
import type { Typed } from "./Typed.ts";
import { annotateProps } from "./annotateProps.ts";
import { applyEdits } from "./applyEdits.ts";
import { calleeUses } from "./calleeUses.ts";
import { dateReads } from "./dateReads.ts";
import { errArgumentAt } from "./errArgumentAt.ts";
import { formatLiterals } from "./formatLiterals.ts";
import { handMadeErrors } from "./handMadeErrors.ts";
import { importMetaDeclarations } from "./importMetaDeclarations.ts";
import { inKernel } from "./inKernel.ts";
import { isAppPath } from "./isAppPath.ts";
import { isCodePath } from "./isCodePath.ts";
import { judgeFormat } from "./judgeFormat.ts";
import { keelThrows } from "./keelThrows.ts";
import { lineCol } from "./lineCol.ts";
import { mapTsDiagnostic } from "./mapTsDiagnostic.ts";
import { nestedResultTypes } from "./nestedResultTypes.ts";
import { otherSpellings } from "./otherSpellings.ts";
import { ownCode } from "./ownCode.ts";
import { packageName } from "./packageName.ts";
import { probeRecorder } from "./probeRecorder.ts";
import { probesHold } from "./probesHold.ts";
import { referenceDirectives } from "./referenceDirectives.ts";
import { resultDiscards } from "./resultDiscards.ts";
import { schemeSelectReads } from "./schemeSelectReads.ts";
import { textNodes } from "./textNodes.ts";
import { tsCode } from "./tsCode.ts";
import { tsCompilerOptions } from "./tsCompilerOptions.ts";
import { typeCache } from "./typeCache.ts";
import { unifiedDiff } from "./unifiedDiff.ts";
import { unprovenPredicates } from "./unprovenPredicates.ts";

/** Fallback global JSX typing when `@keel/runtime-dom/jsx-runtime` does not resolve from `root`. */
const JSX_DTS = `declare namespace JSX {
  type Element = Node;
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements { [tag: string]: { readonly [attr: string]: unknown }; }
}
`;
const JSX_NAME = "__keel_check_jsx__.d.ts";
const DECLARATION = /\.d\.[cm]?ts$/;
/** Kernel and stdlib code and generated output, at the root: E1576's files are the others. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;

/** A workspace package's own folder: kernel and stdlib code, where `supervise` is a library's call (E1461). */
const PACKAGE = /(?:^|\/)packages\/[^/]+\//;
const JSX_SOURCE = "@keel/runtime-dom";
/**
 * Parsed files (app files, node_modules, workspace packages, TS libs) by compiler options, then path: one is reused
 * only by a pass with the same options, while its text is the same (k.check-cache In one process). TypeScript keeps a
 * file's imports on its parsed form, and `jsxImportSource` adds one.
 */
const parsed = new Map<string, Map<string, ts.SourceFile>>();
/** Passes by key; one is reused only while its probes hold (k.check-cache Probes). */
const memo = new Map<string, TypeEntry>();
const MEMO_MAX = 128;

const norm = (p: string): string => p.split(path.sep).join("/");

function parsedFor(options: ts.CompilerOptions): Map<string, ts.SourceFile> {
  const key = JSON.stringify(options);
  const held = parsed.get(key);
  if (held !== undefined) return held;
  const made = new Map<string, ts.SourceFile>();
  parsed.set(key, made);
  return made;
}

function sourceFile(cache: Map<string, ts.SourceFile>, fileName: string, text: string): ts.SourceFile {
  const hit = cache.get(fileName);
  if (hit !== undefined && hit.text === text) return hit;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  cache.set(fileName, sf);
  return sf;
}

/** Type references resolve from the project root's `node_modules` upward, never from the current directory. */
const FROM_ROOT: ts.CompilerOptions = { ...tsCompilerOptions(), typeRoots: [] };

const byPath = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * `view` with each type reference directive of a project file blanked (E1016 reports it; k.boundary Ambient types):
 * `import.meta` and the libs are typed by the pass alone. Offsets are kept, so `original` holds.
 */
function unreferenced(file: SourceFile, view: Annotated): Annotated {
  if (LIBRARY.test(file.path)) return view;
  const found = referenceDirectives(view.text);
  if (found.length === 0) return view;
  let text = view.text;
  for (const { start, end } of found) text = text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
  return { text, original: view.original };
}

/** The key's hash (k.check-cache Key). */
function keyOf(
  code: readonly SourceFile[],
  base: string,
  skip: ReadonlyMap<string, ReadonlySet<string>>,
  library: readonly string[],
  packages: readonly SourceFile[],
): string {
  const own = ownCode();
  const dropped = [...skip].map(([p, s]): [string, string[]] => [p, [...s].sort()]).sort(byPath);
  return createHash("sha256")
    .update(
      JSON.stringify([
        CACHE_FORMAT,
        own.version,
        own.hash,
        ts.version,
        tsCode(),
        tsCompilerOptions(),
        base,
        ts.sys.useCaseSensitiveFileNames,
        code.map((f) => [f.path, f.source]),
        dropped,
        library,
        packages.map((f) => [f.path, f.source]),
      ]),
    )
    .digest("hex");
}

/** The pass's findings as `check()` reports them, each `formatLiteral` call judged against the registry now. */
function resolve(entry: TypeEntry, code: readonly SourceFile[], scope: ReadonlySet<string>): Typed {
  const sources: ReadonlyMap<string, string> = new Map(code.map((f) => [f.path, f.source]));
  const diagnostics = entry.items.flatMap((i) => (i.kind === "diag" ? [i] : judgeFormat(i, sources, scope)));
  return { diagnostics, dates: entry.dates, schemeSelects: entry.schemeSelects, keelThrows: entry.keelThrows };
}

function remember(key: string, entry: TypeEntry): void {
  memo.delete(key);
  if (memo.size >= MEMO_MAX) {
    const first = memo.keys().next();
    if (first.done !== true) memo.delete(first.value);
  }
  memo.set(key, entry);
}

/**
 * Pipeline step 1b (k.check): a strict TypeScript check of the code files over an in-memory host rooted at
 * `root` (imports resolve from its `node_modules`). JSX is typed by `@keel/runtime-dom/jsx-runtime`
 * (`jsxImportSource`), or by a global shim when that does not resolve. Ambient types are Node's,
 * added when `@types/node` resolves from `root`, and `@keel/compiler/client` (k.bundle Types) likewise. Errors that
 * encode a Keel rule are reported under that code (`mapTsDiagnostic`); the rest are E1751. Mapped codes the compiler
 * already reported in the same file are dropped (`skip`). Also finds discarded `Result` expression statements (E1453),
 * the `formatLiteral` calls (E1108), the date receivers E1758 reads, the JSX children that render nothing (E1406),
 * the callees E1451, E1452, E1455, E1207, E1208 and E1203 find by symbol (`calleeUses`) and the type predicates no
 * check proves (E1762), which need types. The project's declaration files are in the program too, and its type reference directives are
 * not (`unreferenced`): a declaration of the global `ImportMeta` or `ImportMetaEnv` outside TypeScript's lib,
 * `@types/node` and `@keel/compiler/client` is E1016 (`importMetaDeclarations`).
 *
 * Every file system question the program asks goes through a recording host (k.check-cache Probes). A pass is kept by
 * key in this process and, with `cacheDir`, on disk (`typeCache`); a kept pass is used only when every recorded
 * question gets the same answer again. Parsed disk files are reused while their text is the same. A library's files
 * (`isLibrary`, k.library) are app code to the pass, and their `package.json` files (`packages`) are read from memory
 * like the code, so an import of a library resolves through its `exports`; both are part of the key.
 */
export function typeCheck(
  files: readonly SourceFile[],
  root: string,
  skip: ReadonlyMap<string, ReadonlySet<string>>,
  scope: ReadonlySet<string>,
  cacheDir?: string,
  isLibrary: (path: string) => boolean = () => false,
  packages: readonly SourceFile[] = [],
): Typed {
  const code = files.filter((f) => isCodePath(f.path));
  const decls = files.filter((f) => DECLARATION.test(f.path) && !LIBRARY.test(f.path));
  if (code.length === 0 && decls.length === 0)
    return { diagnostics: [], dates: new Map(), schemeSelects: new Map(), keelThrows: new Map() };
  const base = norm(path.resolve(root));
  const library = code.filter((f) => isLibrary(f.path)).map((f) => f.path);
  const key = keyOf([...code, ...decls], base, skip, library, packages);
  const held = memo.get(key);
  if (held !== undefined && probesHold(held.probes)) return resolve(held, code, scope);
  const kept = cacheDir === undefined ? undefined : typeCache(cacheDir, key);
  const loaded = kept?.load();
  if (loaded !== undefined && loaded.key === key && probesHold(loaded.probes)) {
    remember(key, loaded);
    return resolve(loaded, code, scope);
  }
  const { entry, whole } = pass(code, decls, base, skip, key, new Set(library), packages);
  if (whole) {
    remember(key, entry);
    kept?.save(entry);
  }
  return resolve(entry, code, scope);
}

/** One TypeScript program over `code`, every disk question recorded; `whole` is false when the disk changed under it. */
function pass(
  code: readonly SourceFile[],
  decls: readonly SourceFile[],
  base: string,
  skip: ReadonlyMap<string, ReadonlySet<string>>,
  key: string,
  library: ReadonlySet<string>,
  packages: readonly SourceFile[],
): { entry: TypeEntry; whole: boolean } {
  const byName = new Map<string, SourceFile>();
  const packageText = new Map(packages.map((f) => [`${base}/${f.path}`, f.source]));
  const views = new Map<string, Annotated>();
  for (const f of code) {
    byName.set(`${base}/${f.path}`, f);
    views.set(`${base}/${f.path}`, unreferenced(f, annotateProps(f.path, f.source)));
  }
  const declNames = new Map<string, SourceFile>();
  for (const f of decls) {
    declNames.set(`${base}/${f.path}`, f);
    views.set(`${base}/${f.path}`, unreferenced(f, { text: f.source, original: (p) => p }));
  }
  const jsxName = `${base}/${JSX_NAME}`;
  const strict = tsCompilerOptions();
  const rec = probeRecorder();
  const host = ts.createCompilerHost(strict, true);
  // Every host method that asks the file system goes through `rec`; the others answer without it.
  host.getCurrentDirectory = () => base;
  host.getEnvironmentVariable = () => undefined;
  host.writeFile = () => undefined;
  host.fileExists = (fileName) =>
    views.has(norm(fileName)) ||
    packageText.has(norm(fileName)) ||
    norm(fileName) === jsxName ||
    rec.fileExists(fileName);
  // In-memory files may sit in folders that are not on disk; module resolution asks for those folders first.
  const dirs = new Set(
    [...views.keys(), ...packageText.keys()].flatMap((n) => n.split("/").map((_, i, p) => p.slice(0, i).join("/"))),
  );
  host.directoryExists = (d) => dirs.has(norm(d).replace(/\/$/, "")) || rec.directoryExists(d);
  // `sys.realpath` missing leaves the host without one too (`createCompilerHost`): no lookup is asked.
  if (rec.realpath !== undefined) host.realpath = rec.realpath;
  host.getDirectories = (d) => rec.getDirectories(d);
  host.readDirectory = (d, extensions, excludes, includes, depth) =>
    rec.readDirectory(d, extensions, excludes, includes, depth);
  host.readFile = (fileName) => {
    const n = norm(fileName);
    if (n === jsxName) return JSX_DTS;
    return views.get(n)?.text ?? packageText.get(n) ?? rec.read(fileName);
  };
  const typeRef = (name: string): string | undefined =>
    ts.resolveTypeReferenceDirective(name, `${base}/__probe__.ts`, FROM_ROOT, host).resolvedTypeReferenceDirective
      ?.resolvedFileName;
  const nodeTypes = typeRef("node");
  const clientTypes = typeRef("@keel/compiler/client");
  const probe = ts.resolveModuleName(`${JSX_SOURCE}/jsx-runtime`, `${base}/__probe__.tsx`, strict, host);
  const shim = probe.resolvedModule === undefined;
  const options: ts.CompilerOptions = shim ? strict : { ...strict, jsxImportSource: JSX_SOURCE };
  const files = parsedFor(options);
  host.getSourceFile = (fileName) => {
    const n = norm(fileName);
    if (n === jsxName) return sourceFile(files, n, JSX_DTS);
    const v = views.get(n);
    if (v !== undefined) return sourceFile(files, n, v.text);
    const text = rec.read(fileName);
    return text === undefined ? undefined : sourceFile(files, n, text);
  };
  const owners = new Map<string, string | null>();
  const ownerOf = (fileName: string): string | null => {
    const held = owners.get(fileName);
    if (held !== undefined) return held;
    const found = packageName(fileName, (f) => host.readFile(f));
    owners.set(fileName, found);
    return found;
  };
  const program = ts.createProgram({
    rootNames: [
      ...byName.keys(),
      ...declNames.keys(),
      ...(shim ? [jsxName] : []),
      ...[nodeTypes, clientTypes].flatMap((t) => (t === undefined ? [] : [t])),
    ],
    options,
    host,
  });
  const checker = program.getTypeChecker();

  const out: (Diagnostic | FormatSite)[] = [];
  const dates = new Map<string, ReadonlySet<number>>();
  const schemeSelects = new Map<string, ReadonlySet<number>>();
  const throws = new Map<string, ReadonlySet<number>>();
  const HAND_MADE = "KeelError written by hand: declare it with s.error and pass X.make(data)";
  const E1458 = "err takes a KeelError: declare it with s.error(code, data) and pass X.make(data)";
  for (const [fileName, file] of byName) {
    const sf = program.getSourceFile(fileName);
    if (sf === undefined) continue;
    const own = skip.get(file.path) ?? new Set<string>();
    const view = views.get(fileName) ?? { text: file.source, original: (p: number) => p };
    const syntactic = own.has("E1000") ? [] : program.getSyntacticDiagnostics(sf);
    const refused = new Set<number>();
    const app = isAppPath(file.path) || library.has(file.path);
    for (const d of [...syntactic, ...program.getSemanticDiagnostics(sf)]) {
      const arg =
        app && d.category === ts.DiagnosticCategory.Error && d.start !== undefined
          ? errArgumentAt(sf, d.start, checker, ownerOf)
          : undefined;
      const argAt = arg === undefined ? -1 : view.original(arg.getStart(sf));
      if (arg !== undefined && argAt >= 0) {
        refused.add(arg.getStart(sf));
        out.push({
          kind: "diag",
          code: "E1458",
          path: file.path,
          ...lineCol(file.source, argAt),
          message: E1458,
          see: "k.attempt",
        });
        continue;
      }
      const mapped = mapTsDiagnostic(d, sf, file, view.original, checker);
      if (mapped === null || (mapped.code !== "E1751" && own.has(mapped.code))) continue;
      out.push(mapped);
    }
    const push = (code: string, at: number, message: string, see: string, end = -1): void => {
      const pos = view.original(at);
      const after = end < 0 ? -1 : view.original(end);
      if (pos < 0) return;
      const fix =
        after < 0
          ? ""
          : unifiedDiff(file.path, file.source, applyEdits(file.source, [{ start: after, end: after, text: "()" }]));
      out.push({
        kind: "diag",
        code,
        path: file.path,
        ...lineCol(file.source, pos),
        message,
        see,
        ...(fix === "" ? {} : { fix }),
      });
    };
    for (const at of resultDiscards(sf, checker))
      push("E1453", at, "Result discarded: narrow on r.ok and handle r.error", "k.errors");
    for (const f of formatLiterals(sf, checker, ownerOf))
      out.push({
        kind: "format",
        path: file.path,
        formatAt: view.original(f.formatAt),
        textAt: view.original(f.textAt),
        names: f.names,
        text: f.text,
        owner: f.owner,
        pkg: f.pkg,
      });
    dates.set(file.path, new Set(dateReads(sf, checker, program).map(view.original)));
    if (app) throws.set(file.path, new Set(keelThrows(sf, checker, ownerOf).map(view.original)));
    if (file.path.endsWith("x"))
      schemeSelects.set(file.path, new Set(schemeSelectReads(sf, checker).map(view.original)));
    if (file.path.endsWith("x") && app)
      for (const t of textNodes(sf, checker))
        push("E1406", t.at, "JSX child renders nothing; call the prop", "k.place", t.fix);
    if (app) {
      for (const u of calleeUses(
        sf,
        checker,
        program,
        ownerOf,
        inKernel(file.path),
        library.has(file.path) || PACKAGE.test(file.path),
      ))
        push(u.code, u.at, u.message, u.see);
      for (const p of unprovenPredicates(sf, checker)) push("E1762", p.at, p.message, "k.identity");
      for (const u of otherSpellings(sf, checker, program)) push(u.code, u.at.getStart(sf), u.message, "k.unsafe");
      for (const t of nestedResultTypes(sf, checker, ownerOf))
        push("E1459", t.getStart(sf), NESTED_RESULT_MESSAGE, "k.attempt");
      if (!inKernel(file.path))
        for (const o of handMadeErrors(sf, checker, ownerOf))
          if (!refused.has(o.getStart(sf))) push("E1458", o.getStart(sf), HAND_MADE, "k.expect");
    }
  }
  const held = new Map(
    [...byName, ...declNames].map(([name, f]) => [
      name,
      { path: f.path, source: f.source, original: views.get(name)?.original ?? ((p: number) => p) },
    ]),
  );
  const libDir = norm(path.dirname(host.getDefaultLibFileName(options)));
  out.push(...importMetaDeclarations(program, host, base, held, { libDir, nodeTypes, clientTypes }));
  const probes = rec.probes();
  return {
    entry: { key, probes: probes ?? [], items: out, dates, schemeSelects, keelThrows: throws },
    whole: probes !== undefined,
  };
}
