import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Annotated } from "./Annotated.ts";
import type { Typed } from "./Typed.ts";
import { annotateProps } from "./annotateProps.ts";
import { applyEdits } from "./applyEdits.ts";
import { dateReads } from "./dateReads.ts";
import { formatLiterals } from "./formatLiterals.ts";
import { isAppPath } from "./isAppPath.ts";
import { lineCol } from "./lineCol.ts";
import { mapTsDiagnostic } from "./mapTsDiagnostic.ts";
import { resultDiscards } from "./resultDiscards.ts";
import { textNodes } from "./textNodes.ts";
import { typeCache } from "./typeCache.ts";
import { tsCompilerOptions } from "./tsCompilerOptions.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/** Fallback global JSX typing when `@keel/runtime-dom/jsx-runtime` does not resolve from `root`. */
const JSX_DTS = `declare namespace JSX {
  type Element = Node;
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements { [tag: string]: { readonly [attr: string]: unknown }; }
}
`;
const JSX_NAME = "__keel_check_jsx__.d.ts";
const CODE = /\.[cm]?[jt]sx?$/;

const JSX_SOURCE = "@keel/runtime-dom";
/** On-disk source files (node_modules, workspace packages, TS libs) keyed by path, valid while mtime holds. */
const disk = new Map<string, { mtime: number; sf: ts.SourceFile }>();
const virtual = new Map<string, ts.SourceFile>();
/** Results by input; valid while every disk file the program read keeps its mtime. */
const memo = new Map<string, { result: Typed; reads: readonly (readonly [string, number])[] }>();
const MEMO_MAX = 128;
let previous: ts.Program | undefined;

const norm = (p: string): string => p.split(path.sep).join("/");

function sourceFile(cache: Map<string, ts.SourceFile>, fileName: string, text: string): ts.SourceFile {
  const hit = cache.get(fileName);
  if (hit !== undefined && hit.text === text) return hit;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  cache.set(fileName, sf);
  return sf;
}

/** Type references resolve from the project root's `node_modules` upward, never from the current directory. */
const FROM_ROOT: ts.CompilerOptions = { ...tsCompilerOptions(), typeRoots: [] };

const mtimeOf = (fileName: string): number => fs.statSync(fileName, { throwIfNoEntry: false })?.mtimeMs ?? -1;

/**
 * Pipeline step 1b (k.check): a strict TypeScript check of the code files over an in-memory host rooted at
 * `root` (imports resolve from its `node_modules`). JSX is typed by `@keel/runtime-dom/jsx-runtime`
 * (`jsxImportSource`), or by a global shim when that does not resolve. Ambient types are Node's,
 * added when `@types/node` resolves from `root`, and `@keel/compiler/client` (k.bundle Types) likewise. Disk files are cached by path and
 * mtime across calls; results are memoized by input and revalidated against those mtimes. Errors that encode a Keel rule are reported under that
 * code (`mapTsDiagnostic`); the rest are E1751. Mapped codes the compiler already reported in the same file
 * are dropped (`skip`). Also finds discarded `Result` expression statements (E1453), the date receivers E1758 reads and the JSX children
 * that render nothing (E1406), which need types. With `cacheDir`, results also persist there across processes (`typeCache`).
 */
export function typeCheck(
  files: readonly SourceFile[],
  root: string,
  skip: ReadonlyMap<string, ReadonlySet<string>>,
  cacheDir?: string,
): Typed {
  const code = files.filter((f) => CODE.test(f.path) && !f.path.endsWith(".d.ts"));
  if (code.length === 0) return { diagnostics: [], dates: new Map() };
  const base = norm(path.resolve(root));
  const nodeTypes = ts.resolveTypeReferenceDirective("node", `${base}/__probe__.ts`, FROM_ROOT, ts.sys)
    .resolvedTypeReferenceDirective?.resolvedFileName;
  const clientTypes = ts.resolveTypeReferenceDirective(
    "@keel/compiler/client",
    `${base}/__probe__.ts`,
    FROM_ROOT,
    ts.sys,
  ).resolvedTypeReferenceDirective?.resolvedFileName;
  const key = [
    base,
    nodeTypes ?? "",
    clientTypes ?? "",
    ...code.map((f) => `${f.path}\u0000${f.source}`),
    ...[...skip].map(([p, s]) => `${p}:${[...s].join(",")}`),
  ].join("\u0001");
  const hit = memo.get(key);
  if (hit?.reads.every(([f, m]) => mtimeOf(f) === m) === true) return hit.result;
  const kept = cacheDir === undefined ? undefined : typeCache(cacheDir, key, ts.version, base);
  const loaded = kept?.load();
  if (loaded !== undefined) return loaded;

  const byName = new Map<string, SourceFile>();
  const views = new Map<string, Annotated>();
  for (const f of code) {
    byName.set(`${base}/${f.path}`, f);
    views.set(`${base}/${f.path}`, annotateProps(f.path, f.source));
  }
  const jsxName = `${base}/${JSX_NAME}`;
  const strict = tsCompilerOptions();
  const host = ts.createCompilerHost(strict, true);
  const readDisk = host.readFile.bind(host);
  const existsDisk = host.fileExists.bind(host);
  host.fileExists = (fileName) => byName.has(norm(fileName)) || norm(fileName) === jsxName || existsDisk(fileName);
  // In-memory files may sit in folders that are not on disk; module resolution asks for those folders first.
  const dirs = new Set([...byName.keys()].flatMap((n) => n.split("/").map((_, i, p) => p.slice(0, i).join("/"))));
  const dirOnDisk = host.directoryExists?.bind(host);
  host.directoryExists = (d) => dirs.has(norm(d).replace(/\/$/, "")) || dirOnDisk?.(d) !== false;
  const probe = ts.resolveModuleName(`${JSX_SOURCE}/jsx-runtime`, `${base}/__probe__.tsx`, strict, host);
  const shim = probe.resolvedModule === undefined;
  const options: ts.CompilerOptions = shim ? strict : { ...strict, jsxImportSource: JSX_SOURCE };
  const reads = new Map<string, number>();
  host.readFile = (fileName) => {
    const n = norm(fileName);
    if (n === jsxName) return JSX_DTS;
    return views.get(n)?.text ?? readDisk(fileName);
  };
  host.getSourceFile = (fileName) => {
    const n = norm(fileName);
    if (n === jsxName) return sourceFile(virtual, n, JSX_DTS);
    const v = views.get(n);
    if (v !== undefined) return sourceFile(virtual, n, v.text);
    const mtime = mtimeOf(fileName);
    reads.set(fileName, mtime);
    const cached = disk.get(n);
    if (cached !== undefined && cached.mtime === mtime) return cached.sf;
    const text = readDisk(fileName);
    if (text === undefined) return undefined;
    const sf = ts.createSourceFile(n, text, ts.ScriptTarget.ES2022, true);
    disk.set(n, { mtime, sf });
    return sf;
  };
  const program = ts.createProgram({
    rootNames: [
      ...byName.keys(),
      ...(shim ? [jsxName] : []),
      ...[nodeTypes, clientTypes].flatMap((t) => (t === undefined ? [] : [t])),
    ],
    options,
    host,
    ...(previous === undefined ? {} : { oldProgram: previous }),
  });
  previous = program;
  const checker = program.getTypeChecker();

  const out: Diagnostic[] = [];
  const dates = new Map<string, ReadonlySet<number>>();
  for (const [fileName, file] of byName) {
    const sf = program.getSourceFile(fileName);
    if (sf === undefined) continue;
    const own = skip.get(file.path) ?? new Set<string>();
    const view = views.get(fileName) ?? { text: file.source, original: (p: number) => p };
    const syntactic = own.has("E1000") ? [] : program.getSyntacticDiagnostics(sf);
    for (const d of [...syntactic, ...program.getSemanticDiagnostics(sf)]) {
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
      push("E1453", at, "Result discarded as a statement; narrow on r.ok", "k.errors");
    for (const f of formatLiterals(sf, checker)) push("E1108", f.at, f.message, "k.formats");
    dates.set(file.path, new Set(dateReads(sf, checker, program).map(view.original)));
    if (file.path.endsWith("x") && isAppPath(file.path))
      for (const t of textNodes(sf, checker))
        push("E1406", t.at, "JSX child renders nothing; call the prop", "k.place", t.fix);
  }
  if (memo.size >= MEMO_MAX) {
    const first = memo.keys().next();
    if (first.done !== true) memo.delete(first.value);
  }
  const result = { diagnostics: out, dates };
  memo.set(key, { result, reads: [...reads] });
  kept?.save(result, [...reads]);
  return result;
}
