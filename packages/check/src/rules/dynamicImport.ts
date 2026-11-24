import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { hostCodeSpecifier } from "../internal/hostCodeSpecifier.ts";
import { hostUses } from "../internal/hostUses.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import { noCodeFromString } from "./noCodeFromString.ts";

const unwrap = (e: Expression): Expression => (e.type === "ParenthesizedExpression" ? unwrap(e.expression) : e);

/**
 * W1608 (k.ctx): an `import()` expression in app code. A module load is I/O no ctx owns, so a `simulate` run
 * neither waits for it nor orders it by seed. Not reported: an `import()` that is E1603 (`noCodeFromString`
 * reports it), a `Host`'s `code` in E1824's form, and a message set's `load` given as the third argument of
 * `messages` from `@keel/std-messages` (E2401's form; the kernel names the specifier, it imports nothing from it).
 * No fix: which static import replaces the load is the author's call.
 */
export const dynamicImport: RuleDef = {
  code: "W1608",
  message: "import() in app code is a load simulate does not track; use a static import",
  see: "k.ctx",
  check: (input) => {
    const { file, ast } = input;
    if (!isAppPath(file.path) || !file.source.includes("import")) return [];
    /** Source ranges whose `import()` is a position a rule already fixes. */
    const exempt: (readonly [number, number])[] = [];
    for (const use of hostUses(ast)) {
      const code = use.props.get("code")?.value ?? null;
      if (code !== null && hostCodeSpecifier(code) !== null) exempt.push([code.start, code.end]);
    }
    const messages = localNames(ast, "messages", "@keel/std-messages");
    const code = new Set(
      noCodeFromString
        .check(input)
        .filter((f) => String(f.data?.name ?? "").startsWith("import("))
        .map((f) => `${f.line}:${f.col}`),
    );
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[2];
        if (n.callee.type !== "Identifier" || !messages.has(n.callee.name)) return;
        if (arg === undefined || arg.type === "SpreadElement") return;
        const load = unwrap(arg);
        if (load.type !== "ArrowFunctionExpression" || load.body.type === "BlockStatement") return;
        const body = unwrap(load.body);
        if (body.type === "ImportExpression") exempt.push([body.start, body.end]);
      },
    }).visit(ast);
    new Visitor({
      ImportExpression: (n) => {
        if (exempt.some(([a, b]) => n.start >= a && n.end <= b)) return;
        const f = findingAt(file, n.start);
        if (!code.has(`${f.line}:${f.col}`)) out.push(f);
      },
    }).visit(ast);
    return out;
  },
};
