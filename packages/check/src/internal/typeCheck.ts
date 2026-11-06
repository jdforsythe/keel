import path from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Annotated } from "./Annotated.ts";
import { annotateProps } from "./annotateProps.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";
import { mapTsDiagnostic } from "./mapTsDiagnostic.ts";
import { resultDiscards } from "./resultDiscards.ts";
import { tsCompilerOptions } from "./tsCompilerOptions.ts";

/** Global JSX typing for app files: elements are DOM `Node`s, children go to the `children` prop. */
const JSX_DTS = `declare namespace JSX {
  type Element = Node;
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements { [tag: string]: { readonly [attr: string]: unknown }; }
}
`;
const JSX_NAME = "__keel_check_jsx__.d.ts";
const CODE = /\.[cm]?[jt]sx?$/;

const disk = new Map<string, ts.SourceFile>();
const virtual = new Map<string, ts.SourceFile>();
const memo = new Map<string, Diagnostic[]>();
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

function isLib(fileName: string): boolean {
  return /\/typescript\/lib\/lib\.[^/]*\.d\.ts$/.test(fileName);
}

/**
 * Pipeline step 1b (k.check): a strict TypeScript check of the code files over an in-memory host rooted at
 * `root` (imports resolve from its `node_modules`). Errors that encode a Keel rule are reported under that
 * code (`mapTsDiagnostic`); the rest are E1751. Mapped codes the compiler already reported in the same file
 * are dropped (`skip`). Also finds discarded `Result` expression statements (E1453), which need types.
 */
export function typeCheck(
  files: readonly SourceFile[],
  root: string,
  skip: ReadonlyMap<string, ReadonlySet<string>>,
): Diagnostic[] {
  const code = files.filter((f) => CODE.test(f.path) && !f.path.endsWith(".d.ts"));
  if (code.length === 0) return [];
  const base = norm(path.resolve(root));
  const key = [
    base,
    ...code.map((f) => `${f.path}\u0000${f.source}`),
    ...[...skip].map(([p, s]) => `${p}:${[...s].join(",")}`),
  ].join("\u0001");
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const byName = new Map<string, SourceFile>();
  const views = new Map<string, Annotated>();
  for (const f of code) {
    byName.set(`${base}/${f.path}`, f);
    views.set(`${base}/${f.path}`, annotateProps(f.path, f.source));
  }
  const jsxName = `${base}/${JSX_NAME}`;
  const options = tsCompilerOptions();
  const host = ts.createCompilerHost(options, true);
  const readDisk = host.readFile.bind(host);
  const existsDisk = host.fileExists.bind(host);
  host.fileExists = (fileName) => byName.has(norm(fileName)) || norm(fileName) === jsxName || existsDisk(fileName);
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
    if (isLib(n)) {
      const lib = disk.get(n);
      if (lib !== undefined) return lib;
    }
    const text = readDisk(fileName);
    return text === undefined ? undefined : sourceFile(disk, n, text);
  };
  const program = ts.createProgram({
    rootNames: [...byName.keys(), jsxName],
    options,
    host,
    ...(previous === undefined ? {} : { oldProgram: previous }),
  });
  previous = program;
  const checker = program.getTypeChecker();

  const out: Diagnostic[] = [];
  for (const [fileName, file] of byName) {
    const sf = program.getSourceFile(fileName);
    if (sf === undefined) continue;
    const own = skip.get(file.path) ?? new Set<string>();
    const view = views.get(fileName) ?? { text: file.source, original: (p: number) => p };
    const syntactic = own.has("E1000") ? [] : program.getSyntacticDiagnostics(sf);
    for (const d of [...syntactic, ...program.getSemanticDiagnostics(sf)]) {
      const mapped = mapTsDiagnostic(d, sf, file, view.original);
      if (mapped === null || (mapped.code !== "E1751" && own.has(mapped.code))) continue;
      out.push(mapped);
    }
    for (const at of resultDiscards(sf, checker)) {
      const pos = view.original(at);
      if (pos < 0) continue;
      const { line, col } = lineCol(file.source, pos);
      out.push({
        kind: "diag",
        code: "E1453",
        path: file.path,
        line,
        col,
        message: clip("Result discarded as a statement; narrow on r.ok", 89),
        see: "k.errors",
      });
    }
  }
  if (memo.size >= MEMO_MAX) {
    const first = memo.keys().next();
    if (first.done !== true) memo.delete(first.value);
  }
  memo.set(key, out);
  return out;
}
