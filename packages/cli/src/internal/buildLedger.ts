import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import type { Diag } from "./Diag.ts";
import type { LedgerItem } from "./LedgerItem.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import type { TestRef } from "./TestRef.ts";
import { makeDiag } from "./makeDiag.ts";
import { scrubCode } from "./scrubCode.ts";
import { specClauses } from "./specClauses.ts";
import { testEvidence } from "./testEvidence.ts";

const FN_DECL = /^export\s+(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/;
const FN_CONST =
  /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const APP_EXPORT = /^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/;
const APP_DEFAULT = /^export\s+default\b/;
/** A component's `Props` and `uses` belong to the component; `module.ts` and `routes.ts` are manifests. */
const APP_PARTS = new Set(["Props", "uses"]);
const APP_MANIFESTS = new Set(["module.ts", "routes.ts"]);
/** `unsafe(...)` and `unsafe<T>(...)` calls; the declaration `function unsafe<T>(` is not a use. */
const UNSAFE_CALL = /(?<!function\s)\bunsafe\s*(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?\s*\(/g;
const PKG = /^packages\/([^/]+)\/([^/]+)\//;
const APP = /^apps\/([^/]+)\/(.+)$/;
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
const evidenceFor = (refs: readonly TestRef[], name: string): LedgerItem["evidence"] =>
  refs.filter((r) => r.names.has(name)).map((r) => ({ ev: r.ev, path: r.path }));

/**
 * Ledger items, pure over the given files (k.testing Ledger; the one implementation, `keel ledger`):
 * - every exported function in `packages/<pkg>/src/*.ts` (`<file>#<name>`), with evidence from the package's
 *   `test/` and `conformance/` tests that reach it (`testEvidence`: an import or a call by name inside a
 *   non-skipped test body or a helper it calls; never a comment, a string, or a skipped test);
 * - every export of `apps/<app>/modules/**` except manifests and component parts (`<app>:<path>#<name>`), with
 *   evidence from the app's `test/` and co-located tests;
 * - every spec Conformance clause (`k.cli#7`), with the tests of conformance files whose leading `// Spec:` header
 *   names the section and quotes the clause. A `// Clause:` header is not read; it is W1706 with the fix.
 * Also the `unsafe(...)` calls in `packages/<pkg>/{src,unsafe}` and, per app, in `apps/<app>/**`.
 */
export function buildLedger(files: readonly SourceFile[]): {
  items: LedgerItem[];
  unsafe: number;
  appUnsafe: Record<string, number>;
  diags: Diag[];
} {
  const code = files.filter((f) => CODE_FILE.test(f.path));
  const areas = new Map<string, SourceFile[]>();
  const add = (area: string, f: SourceFile): void => {
    areas.set(area, [...(areas.get(area) ?? []), f]);
  };
  let unsafe = 0;
  const appUnsafe: Record<string, number> = {};
  for (const f of code) {
    const p = PKG.exec(f.path);
    const a = APP.exec(f.path);
    if (p?.[1] !== undefined && (p[2] === "test" || p[2] === "conformance")) add(`packages/${p[1]}`, f);
    if (p?.[1] !== undefined && (p[2] === "src" || p[2] === "unsafe")) unsafe += countUnsafe(f.source);
    if (a?.[1] === undefined || a[2] === undefined) continue;
    appUnsafe[a[1]] = (appUnsafe[a[1]] ?? 0) + countUnsafe(f.source);
    if (a[2].startsWith("test/") || (a[2].startsWith("modules/") && TEST_FILE.test(f.path))) add(`apps/${a[1]}`, f);
  }
  const refs = new Map([...areas].map(([area, fs]) => [area, testEvidence(fs)]));
  const items: LedgerItem[] = [];
  const push = (item: string, pkg: string, area: string, name: string): void => {
    if (!items.some((i) => i.item === item))
      items.push({ item, pkg, evidence: evidenceFor(refs.get(area) ?? [], name) });
  };
  for (const f of code) {
    const p = PKG.exec(f.path);
    if (p?.[1] !== undefined && p[2] === "src" && f.path.endsWith(".ts") && f.path.split("/").length === 4)
      for (const l of scrubCode(f.source)) {
        const name = (FN_DECL.exec(l) ?? FN_CONST.exec(l))?.[1];
        if (name !== undefined) push(`${f.path}#${name}`, p[1], `packages/${p[1]}`, name);
      }
    const a = APP.exec(f.path);
    const rel = a?.[2]?.startsWith("modules/") === true ? a[2].slice("modules/".length) : undefined;
    const base = f.path.split("/").pop() ?? "";
    if (a?.[1] === undefined || rel === undefined || TEST_FILE.test(f.path) || APP_MANIFESTS.has(base)) continue;
    for (const l of scrubCode(f.source)) {
      const name = APP_EXPORT.exec(l)?.[1] ?? (APP_DEFAULT.test(l) ? base.split(".")[0] : undefined);
      if (name !== undefined && !APP_PARTS.has(name)) push(`${a[1]}:${rel}#${name}`, a[1], `apps/${a[1]}`, name);
    }
  }
  items.sort((x, y) => (x.item < y.item ? -1 : x.item > y.item ? 1 : 0));

  const sections = new Set(specClauses(files).map((c) => c.id));
  const conformance = code.filter((f) => PKG.exec(f.path)?.[2] === "conformance" && TEST_FILE.test(f.path));
  const diags: Diag[] = [];
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
          see: "k.testing",
        }),
      );
    }
    const spec = head
      .filter((x) => x.text.includes("Spec:"))
      .map((x) => x.text)
      .join("\n");
    return {
      path: f.path,
      spec,
      tests: (refs.get(`packages/${PKG.exec(f.path)?.[1] ?? ""}`) ?? []).filter((r) => r.path === f.path),
    };
  });
  for (const { id, n, text } of specClauses(files)) {
    const bare = text.replace(/\.$/, "");
    const named = new RegExp(`Spec: ${id.replace(/\./g, "\\.")}\\b`);
    const evidence = headed
      .filter((h) => named.test(h.spec) && h.spec.includes(bare))
      .flatMap((h) => h.tests.map((t) => ({ ev: t.ev, path: t.path })));
    items.push({ item: `${id}#${n}`, evidence });
  }
  return { items, unsafe, appUnsafe, diags };
}
