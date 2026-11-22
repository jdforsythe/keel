import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { Diag } from "./Diag.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import type { TestRef } from "./TestRef.ts";
import { citesClause } from "./citesClause.ts";
import { countHosts } from "./countHosts.ts";
import { headerCodes } from "./headerCodes.ts";
import { makeDiag } from "./makeDiag.ts";
import { monitoredEvidence } from "./monitoredEvidence.ts";
import { rangeCodes } from "./rangeCodes.ts";
import { scrubCode } from "./scrubCode.ts";
import { specClauses } from "./specClauses.ts";
import { specHeaders } from "./specHeaders.ts";
import { testEvidence } from "./testEvidence.ts";
import { z3Version } from "./z3Version.ts";

const EXPORT = /^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/;
const APP_DEFAULT = /^export\s+default\b/;
/** A component's `Props` and `uses` belong to the component; `module.ts` and `routes.ts` are manifests. */
const APP_PARTS = new Set(["Props", "uses"]);
const APP_MANIFESTS = new Set(["module.ts", "routes.ts"]);
/** `unsafe(...)` and `unsafe<T>(...)` calls; the declaration `function unsafe<T>(` is not a use. */
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?\s*\(/g;
const PKG = /^packages\/([^/]+)\/([^/]+)\//;
const APP = /^apps\/([^/]+)\/(.+)$/;
/** An app's own modules when `keel ledger` runs in the app's folder. */
const ROOT_APP = /^modules\//;
const OTHER_HEADER = "// Clause:";

/**
 * A file's header comments, with 1-based line numbers: the `//` lines before its first statement other than an
 * import (an import sorter may move a header below the imports).
 */
const header = (source: string): { line: number; text: string }[] => {
  const out: { line: number; text: string }[] = [];
  let inImport = false;
  for (const [i, l] of source.split("\n").entries()) {
    if (l.startsWith("//")) out.push({ line: i + 1, text: l });
    else if (inImport || l.startsWith("import ")) inImport = !/(?:from\s*|^import\s*)["'][^"']*["'];?\s*$/.test(l);
    else if (l.trim() !== "") break;
  }
  return out;
};

const countUnsafe = (source: string): number =>
  scrubCode(source).reduce((n, l) => n + (l.match(UNSAFE_CALL) ?? []).length, 0);

/** Evidence for `name` from an area's executed tests (`testEvidence`): every test that reaches it. */
const evidenceFor = (refs: readonly TestRef[], name: string, file: string): LedgerItem["evidence"] =>
  refs.filter((r) => r.names.has(name) || r.pinned.has(`${file}#${name}`)).map((r) => ({ ev: r.ev, path: r.path }));

/**
 * Ledger items, pure over the given files (k.ledger; the one implementation, `keel ledger`):
 * - every export (`const`, `let`, `function`, `class`) of `packages/<pkg>/src/*.ts` (`<file>#<name>`), with evidence from the package's
 *   `test/` and `conformance/` tests that reach it (`testEvidence`: an import or a call by name inside a
 *   non-skipped test body or a helper it calls; never a comment, a string, or a skipped test);
 * - every export of `apps/<app>/modules/**` except manifests and component parts (`<app>:<path>#<name>`), with
 *   evidence from the app's `test/` and co-located tests;
 * - every spec Conformance clause (`k.cli#7`), with the non-skipped tests of every conformance file, in any package,
 *   with a leading `// Spec: <id>` header block (`specHeaders`, which may wrap) that quotes the clause (`citesClause`:
 *   backticks, quote style, spacing and case aside). A range clause (`rangeCodes`) has evidence only while each of its
 *   codes is named outside the quote (`headerCodes`) in the header of a citing file with a non-skipped test. A
 *   `// Clause:` header is not read; it is W1706 with the fix.
 * Export items also get `monitored` evidence from `.keel/monitored.json` (`monitoredEvidence`; E1711 when it fails its
 * shape). Also the `unsafe(...)` calls in `packages/<pkg>/{src,unsafe}`, in a root `modules/**` (an app's own folder)
 * and, per app, in `apps/<app>/**`, and the host elements (`countHosts`) in those files and, per file, in a root
 * `modules/**`. `z3` is the Z3
 * version a `prove` call's `proven` evidence names (default: the installed `z3-solver`'s, `z3Version`).
 */
export function buildLedger(
  files: readonly SourceFile[],
  z3: string | undefined = z3Version(),
): {
  items: LedgerItem[];
  unsafe: number;
  appUnsafe: Record<string, number>;
  hostElements: number;
  appHosts: Record<string, number>;
  rootHosts: Record<string, number>;
  diags: Diag[];
} {
  const code = files.filter((f) => CODE_FILE.test(f.path));
  const areas = new Map<string, SourceFile[]>();
  const add = (area: string, f: SourceFile): void => {
    areas.set(area, [...(areas.get(area) ?? []), f]);
  };
  let unsafe = 0;
  const appUnsafe: Record<string, number> = {};
  let hostElements = 0;
  const appHosts: Record<string, number> = {};
  const rootHosts: Record<string, number> = {};
  for (const f of code) {
    const p = PKG.exec(f.path);
    const a = APP.exec(f.path);
    if (p?.[1] !== undefined && (p[2] === "test" || p[2] === "conformance")) add(`packages/${p[1]}`, f);
    if (p?.[1] !== undefined && (p[2] === "src" || p[2] === "unsafe")) {
      unsafe += countUnsafe(f.source);
      hostElements += countHosts(f.path, f.source);
    }
    if (ROOT_APP.test(f.path)) {
      unsafe += countUnsafe(f.source);
      const n = countHosts(f.path, f.source);
      hostElements += n;
      if (n > 0) rootHosts[f.path] = n;
    }
    if (a?.[1] === undefined || a[2] === undefined) continue;
    appUnsafe[a[1]] = (appUnsafe[a[1]] ?? 0) + countUnsafe(f.source);
    const hosts = countHosts(f.path, f.source);
    hostElements += hosts;
    appHosts[a[1]] = (appHosts[a[1]] ?? 0) + hosts;
    if (a[2].startsWith("test/") || (a[2].startsWith("modules/") && TEST_FILE.test(f.path))) add(`apps/${a[1]}`, f);
  }
  const known = new Set(code.map((f) => f.path));
  const refs = new Map([...areas].map(([area, fs]) => [area, testEvidence(fs, known, z3)]));
  const monitored = monitoredEvidence(files);
  const found: { item: string; pkg: string; area: string; name: string; path: string }[] = [];
  const push = (item: string, pkg: string, area: string, name: string, path: string): void => {
    if (!found.some((i) => i.item === item)) found.push({ item, pkg, area, name, path });
  };
  for (const f of code) {
    const p = PKG.exec(f.path);
    if (p?.[1] !== undefined && p[2] === "src" && f.path.endsWith(".ts") && f.path.split("/").length === 4)
      for (const l of scrubCode(f.source)) {
        const name = EXPORT.exec(l)?.[1];
        if (name !== undefined) push(`${f.path}#${name}`, p[1], `packages/${p[1]}`, name, f.path);
      }
    const a = APP.exec(f.path);
    const rel = a?.[2]?.startsWith("modules/") ? a[2].slice("modules/".length) : undefined;
    const base = f.path.split("/").pop() ?? "";
    if (a?.[1] === undefined || rel === undefined || TEST_FILE.test(f.path) || APP_MANIFESTS.has(base)) continue;
    for (const l of scrubCode(f.source)) {
      const name = EXPORT.exec(l)?.[1] ?? (APP_DEFAULT.test(l) ? base.split(".")[0] : undefined);
      if (name !== undefined && !APP_PARTS.has(name))
        push(`${a[1]}:${rel}#${name}`, a[1], `apps/${a[1]}`, name, f.path);
    }
  }
  // A relative import pins a name to the file declaring it; one resolving to a file that only re-exports the name
  // (an `index.ts`) reaches it by name, as a package import does.
  const declared = new Set(found.map((i) => `${i.path}#${i.name}`));
  const loose = (r: TestRef): ReadonlySet<string> =>
    new Set([...r.names, ...[...r.pinned].filter((k) => !declared.has(k)).map((k) => k.slice(k.lastIndexOf("#") + 1))]);
  const reach = new Map([...refs].map(([area, rs]) => [area, rs.map((r) => ({ ...r, names: loose(r) }))]));
  const items: LedgerItem[] = found.map((i) => ({
    item: i.item,
    pkg: i.pkg,
    evidence: [...evidenceFor(reach.get(i.area) ?? [], i.name, i.path), ...(monitored.byFile.get(i.path) ?? [])],
  }));
  items.sort((x, y) => (x.item < y.item ? -1 : x.item > y.item ? 1 : 0));

  const sections = new Set(specClauses(files).map((c) => c.id));
  const conformance = code.filter((f) => PKG.exec(f.path)?.[2] === "conformance" && TEST_FILE.test(f.path));
  const diags: Diag[] = [...monitored.diags];
  const headed = conformance.map((f) => {
    const head = header(f.source);
    for (const h of head.filter((x) => x.text.startsWith(OTHER_HEADER))) {
      const pkg = PKG.exec(f.path)?.[1] ?? "";
      const id = sections.has(`k.${pkg}`) ? `k.${pkg}` : "<section>";
      const clause = h.text.slice(OTHER_HEADER.length).trim();
      diags.push(
        makeDiag("W1706", "clause header not counted by the ledger; name it with // Spec:", {
          path: f.path,
          line: h.line,
          col: 1,
          fix: `-${h.text}\n+// Spec: ${id}, clause "${clause}"`,
          see: "k.ledger",
        }),
      );
    }
    return {
      path: f.path,
      head: head.map((h) => h.text),
      blocks: specHeaders(head),
      tests: (refs.get(`packages/${PKG.exec(f.path)?.[1] ?? ""}`) ?? []).filter((r) => r.path === f.path),
    };
  });
  for (const { id, n, text } of specClauses(files)) {
    const citing = headed.filter((h) => h.blocks.some((b) => b.section === id && citesClause(b.text, text)));
    const range = rangeCodes(text);
    const named = new Set(citing.filter((h) => h.tests.length > 0).flatMap((h) => [...headerCodes(h.head, text)]));
    const held = range === undefined || range.every((c) => named.has(c));
    const evidence = held ? citing.flatMap((h) => h.tests.map((t) => ({ ev: t.ev, path: t.path }))) : [];
    items.push({ item: `${id}#${n}`, evidence });
  }
  return { items, unsafe, appUnsafe, hostElements, appHosts, rootHosts, diags };
}
