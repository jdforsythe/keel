import path from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { ambientMessage } from "./ambientMessage.ts";
import { isRecord } from "./compat/isRecord.ts";
import { importSites } from "./importSites.ts";
import { lineCol } from "./lineCol.ts";

/** A project file as the type pass holds it: its project-relative path, original text and the map into that text. */
type Held = { readonly path: string; readonly source: string; readonly original: (pos: number) => number };

const norm = (p: string): string => p.split(path.sep).join("/");
/** Kernel and stdlib code and generated output, at the root: E1576's files are the others. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;
const GLOBALS = ["ImportMeta", "ImportMetaEnv"];
const MEANING = ts.SymbolFlags.Type | ts.SymbolFlags.Value | ts.SymbolFlags.Namespace;

/** Where a declaration sits: its keyword (`interface`, `class`, …) past any doc comment and modifiers, else its start. */
function declarationAt(decl: ts.Declaration, sf: ts.SourceFile): number {
  for (const child of decl.getChildren(sf)) {
    if (child.kind === ts.SyntaxKind.SyntaxList) continue;
    if (child.kind >= ts.SyntaxKind.FirstJSDocNode && child.kind <= ts.SyntaxKind.LastJSDocNode) continue;
    if (child.kind >= ts.SyntaxKind.FirstKeyword && child.kind <= ts.SyntaxKind.LastKeyword) return child.getStart(sf);
    break;
  }
  return decl.getStart(sf);
}

/** `<name>/<path in the package>` of the nearest `package.json` above `fileName` that names one, else `undefined`. */
function specifierOf(fileName: string, read: (file: string) => string | undefined): string | undefined {
  let dir = path.posix.dirname(fileName);
  for (;;) {
    const text = read(`${dir}/package.json`);
    if (text !== undefined) {
      try {
        const v: unknown = JSON.parse(text);
        if (isRecord(v) && typeof v.name === "string") return `${v.name}/${path.posix.relative(dir, fileName)}`;
      } catch {
        // Not JSON: look further up, as a package without a name is no package.
      }
    }
    const up = path.posix.dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

/**
 * E1016 (k.boundary Ambient types), the declaration: each file of `program` holding a declaration of the global
 * `ImportMeta` or `ImportMetaEnv`, other than TypeScript's lib files (`libDir`), `@types/node` (`nodeTypes`'s folder,
 * or any file whose last `node_modules/` entry is `@types/node`) and `@keel/compiler/client` (`clientTypes`), once per
 * file, no fix. A project file (E1576's files: `held` or under `base`, outside `packages/`, `.keel/` and any
 * `node_modules/`) is reported at its first such declaration. Any other is a package file, reported at the first
 * import, by project path then position, of a project file whose target loads it through package files: the target is
 * the file, or reaches it by imports, `import()` types, augmentations or `/// <reference types|path>`. A package file
 * that no project import loads is none: only Keel's own code (`packages/`, the JSX runtime) loads it. Disk questions
 * go through `host`, the pass's recording host.
 */
export function importMetaDeclarations(
  program: ts.Program,
  host: ts.CompilerHost,
  base: string,
  held: ReadonlyMap<string, Held>,
  exempt: { readonly libDir: string; readonly nodeTypes: string | undefined; readonly clientTypes: string | undefined },
): Diagnostic[] {
  const checker = program.getTypeChecker();
  const nodeDir = exempt.nodeTypes === undefined ? undefined : `${path.posix.dirname(norm(exempt.nodeTypes))}/`;
  const client = exempt.clientTypes === undefined ? undefined : norm(exempt.clientTypes);
  const projectOf = (fileName: string): Held | undefined => {
    const own = held.get(fileName);
    if (own !== undefined) return LIBRARY.test(own.path) ? undefined : own;
    if (!fileName.startsWith(`${base}/`)) return undefined;
    const rel = fileName.slice(base.length + 1);
    if (LIBRARY.test(rel) || rel.split("/").includes("node_modules")) return undefined;
    const sf = program.getSourceFile(fileName);
    return sf === undefined ? undefined : { path: rel, source: sf.text, original: (p) => p };
  };
  const isExempt = (fileName: string): boolean => {
    if (projectOf(fileName) !== undefined) return false;
    if (path.posix.dirname(fileName) === exempt.libDir) return true;
    if (fileName === client) return true;
    if (nodeDir !== undefined && fileName.startsWith(nodeDir)) return true;
    const last = fileName.lastIndexOf("/node_modules/");
    return last >= 0 && fileName.startsWith("/node_modules/@types/node/", last);
  };

  const declared = new Map<string, ts.Declaration[]>();
  for (const name of GLOBALS) {
    const symbol = checker.resolveName(name, undefined, MEANING, false);
    for (const decl of symbol?.declarations ?? []) {
      const fileName = norm(decl.getSourceFile().fileName);
      if (isExempt(fileName)) continue;
      declared.set(fileName, [...(declared.get(fileName) ?? []), decl]);
    }
  }
  if (declared.size === 0) return [];

  const out: Diagnostic[] = [];
  const finding = (file: Held, at: number, message: string): Diagnostic => {
    const pos = file.original(at);
    return {
      kind: "diag",
      code: "E1016",
      path: file.path,
      ...lineCol(file.source, pos < 0 ? 0 : pos),
      message,
      see: "k.boundary",
    };
  };
  const packages: string[] = [];
  for (const [fileName, decls] of declared) {
    const file = projectOf(fileName);
    if (file === undefined) {
      packages.push(fileName);
      continue;
    }
    const sf = decls[0]?.getSourceFile();
    if (sf === undefined) continue;
    const first = Math.min(...decls.map((d) => declarationAt(d, sf)));
    out.push(finding(file, first, ambientMessage(file.path)));
  }
  if (packages.length === 0) return out;

  const options = program.getCompilerOptions();
  const cache = ts.createModuleResolutionCache(base, (s) => s, options);
  const loaded = (fileName: string | undefined): string | undefined => {
    if (fileName === undefined) return undefined;
    const sf = program.getSourceFile(fileName);
    return sf === undefined ? undefined : norm(sf.fileName);
  };
  const target = (sf: ts.SourceFile, spec: ts.StringLiteralLike): string | undefined =>
    loaded(
      ts.resolveModuleName(
        spec.text,
        sf.fileName,
        options,
        host,
        cache,
        undefined,
        program.getModeForUsageLocation(sf, spec),
      ).resolvedModule?.resolvedFileName,
    );
  // Which package files load each package file: the reverse of their imports and references.
  const loadedBy = new Map<string, Set<string>>();
  const edge = (from: string, to: string | undefined): void => {
    if (to === undefined || projectOf(to) !== undefined) return;
    loadedBy.set(to, (loadedBy.get(to) ?? new Set()).add(from));
  };
  for (const sf of program.getSourceFiles()) {
    const from = norm(sf.fileName);
    if (projectOf(from) !== undefined || path.posix.dirname(from) === exempt.libDir) continue;
    for (const { spec } of importSites(sf)) edge(from, target(sf, spec));
    for (const ref of sf.typeReferenceDirectives)
      edge(
        from,
        loaded(
          ts.resolveTypeReferenceDirective(ref.fileName, sf.fileName, options, host).resolvedTypeReferenceDirective
            ?.resolvedFileName,
        ),
      );
    for (const ref of sf.referencedFiles) {
      const p = path.posix.resolve(path.posix.dirname(from), ref.fileName);
      edge(from, loaded(p) ?? loaded(`${p}.ts`) ?? loaded(`${p}.tsx`) ?? loaded(`${p}.d.ts`));
    }
  }

  const projects = program
    .getSourceFiles()
    .flatMap((sf) => {
      const file = projectOf(norm(sf.fileName));
      return file === undefined ? [] : [{ sf, file }];
    })
    .sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
  const sites = projects.map(({ sf, file }) => ({
    file,
    targets: importSites(sf).map((s) => ({ at: s.at, to: target(sf, s.spec) })),
  }));
  for (const declaring of packages.sort()) {
    const reaches = new Set([declaring]);
    const queue = [declaring];
    for (let next = queue.shift(); next !== undefined; next = queue.shift())
      for (const by of loadedBy.get(next) ?? [])
        if (!reaches.has(by)) {
          reaches.add(by);
          queue.push(by);
        }
    const message = ambientMessage(
      specifierOf(declaring, (f) => host.readFile(f)) ?? path.posix.relative(base, declaring),
    );
    const hit = sites
      .flatMap(({ file, targets }) =>
        targets.flatMap((t) => (t.to !== undefined && reaches.has(t.to) ? [{ file, at: t.at }] : [])),
      )
      .at(0);
    if (hit !== undefined) out.push(finding(hit.file, hit.at, message));
  }
  return out;
}
