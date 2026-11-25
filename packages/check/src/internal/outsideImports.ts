import fs from "node:fs";
import path from "node:path";
import { shortPath } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Checked } from "./Checked.ts";
import type { SpecifierLiteral } from "./SpecifierLiteral.ts";
import { isTestPath } from "./isTestPath.ts";
import { lineCol } from "./lineCol.ts";
import { specifierLiterals } from "./specifierLiterals.ts";

/** Kernel and stdlib code and generated output, at the root: E1576's files are the others. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;
const TAIL = "' resolves outside the project; check reads only its files";

/** The relative specifiers of `parsed` beside its literal ones: a template `import()`'s head and `new URL`'s literal. */
function moreSpecifiers(checked: Checked): SpecifierLiteral[] {
  const out: SpecifierLiteral[] = [];
  new Visitor({
    ImportExpression: (n) => {
      const x = n.source;
      const head = x.type === "TemplateLiteral" && x.expressions.length > 0 ? x.quasis[0]?.value.cooked : undefined;
      if (typeof head === "string") out.push({ spec: head.slice(0, head.lastIndexOf("/") + 1), start: x.start, end: x.end });
    },
    NewExpression: (n) => {
      const [first, second] = n.arguments;
      const meta = second?.type === "MemberExpression" && second.object.type === "MetaProperty";
      if (n.callee.type === "Identifier" && n.callee.name === "URL" && meta && first?.type === "Literal")
        if (typeof first.value === "string") out.push({ spec: first.value, start: first.start, end: first.end });
    },
  }).visit(checked.parsed.program);
  return out;
}

/** Whether `rel` (a path relative to a project folder) climbs out of it. */
const climbs = (rel: string): boolean => rel === ".." || rel.startsWith("../") || path.isAbsolute(rel);

/**
 * E1015 (k.boundary Following): a relative specifier in a non-test project code file (E1576's files) that resolves
 * outside its project folder (`dirs`, deepest first), by its path or, when it names a file on disk under `root`, by
 * that file's real path. Reported at the opening quote, no fix.
 */
export function outsideImports(checked: readonly Checked[], root: string, dirs: readonly string[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of checked) {
    const { file } = c;
    if (LIBRARY.test(file.path) || isTestPath(file.path)) continue;
    const dir = dirs.find((d) => file.path.startsWith(d)) ?? "";
    const own = file.path.slice(dir.length);
    const base = path.join(root, dir);
    for (const lit of [...specifierLiterals(c.parsed.program), ...moreSpecifiers(c)]) {
      if (!lit.spec.startsWith("./") && !lit.spec.startsWith("../")) continue;
      const bare = lit.spec.split("?")[0] ?? lit.spec;
      const joined = path.posix.join(path.posix.dirname(own), bare);
      if (!climbs(joined) && !leavesOnDisk(base, joined)) continue;
      out.push({
        kind: "diag",
        code: "E1015",
        path: file.path,
        ...lineCol(file.source, lit.start),
        message: `'${shortPath(lit.spec, 89 - `'${TAIL}`.length)}${TAIL}`,
        see: "k.boundary",
      });
    }
  }
  return out;
}

/** Whether `rel` under absolute project folder `base` names an existing file or folder whose real path is outside it. */
function leavesOnDisk(base: string, rel: string): boolean {
  try {
    const real = fs.realpathSync(base);
    const target = fs.realpathSync(path.join(base, rel));
    return climbs(path.relative(real, target));
  } catch {
    return false;
  }
}
