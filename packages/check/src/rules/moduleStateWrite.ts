import { type Expression, type TSType, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { moduleState } from "../internal/moduleState.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const LIBRARY = /^packages\//;
/** The calls that write a `Map`, `Set`, `WeakMap`, `WeakSet` or array. */
const WRITES: ReadonlySet<string> = new Set([
  "set",
  "add",
  "delete",
  "clear",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);
const COLLECTIONS: ReadonlySet<string> = new Set(["Map", "Set", "WeakMap", "WeakSet", "Array"]);

/** Whether a top-level binding's type annotation names a collection: `Map<..>`, `Set<..>`, `T[]`, `Array<T>`. */
const collectionType = (t: TSType | null): boolean =>
  t !== null &&
  (t.type === "TSArrayType" ||
    (t.type === "TSTypeReference" && t.typeName.type === "Identifier" && COLLECTIONS.has(t.typeName.name)));
/** Whether an initializer makes a collection: `new Map(..)` and the like, or an array literal. */
const collectionInit = (e: Expression | null): boolean => {
  const x = e?.type === "ParenthesizedExpression" ? e.expression : e;
  return (
    x?.type === "ArrayExpression" ||
    (x?.type === "NewExpression" && x.callee.type === "Identifier" && COLLECTIONS.has(x.callee.name))
  );
};

/** The identifier at the root of a member chain (`conf` of `conf.a.b` and `conf[k]`), else `null`. */
function rootOf(e: Expression): string | null {
  if (e.type === "Identifier") return e.name;
  if (e.type === "MemberExpression") return rootOf(e.object);
  if (e.type === "ParenthesizedExpression") return rootOf(e.expression);
  return null;
}

/**
 * E1260 (k.shared At check): in server code (a `*.server.ts` file, or one that calls `loader`, `action` or `guard`),
 * a write, inside a function, to plain module state, at the write: an assignment (`=` or compound) or `++`/`--` of a
 * top-level `let` or `var`, or of a property or element of any top-level binding; or a call of a collection's writing
 * method on a top-level binding made or typed as a `Map`, `Set`, `WeakMap`, `WeakSet` or array. A binding made by
 * `processSlot(...)` (`@keel/ctx`) is a named slot and not judged, nor a name a function encloses as its own. Files
 * under the root's `packages/` are kernel and stdlib code, not app files. No fix (k.fixes).
 */
export const moduleStateWrite: RuleDef = {
  code: "E1260",
  message:
    "module state written in server code: per request use the request's scope, per process use processSlot(name, make)",
  see: "k.shared",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path) || LIBRARY.test(file.path)) return [];
    const m = moduleState(file, ast, project);
    if (!m.server) return [];
    const out: Finding[] = [];
    /** Whether a write at `at` whose target is rooted at `name` (`direct` for the name itself) is module state. */
    const judged = (name: string | null, at: number, direct: boolean): boolean => {
      if (name === null || !m.inFunction(at) || m.shadowed(name, at)) return false;
      const b = m.top.get(name);
      if (b === undefined || m.isSlot(b)) return false;
      return direct ? b.kind === "let" || b.kind === "var" : true;
    };
    const target = (start: number, left: Expression): void => {
      const direct = left.type === "Identifier";
      if (judged(rootOf(left), start, direct)) out.push(findingAt(file, start));
    };
    new Visitor({
      AssignmentExpression: (n) => {
        const l = n.left;
        if (l.type === "Identifier" || l.type === "MemberExpression") target(n.start, l);
      },
      UpdateExpression: (n) => {
        const a = n.argument;
        if (a.type === "Identifier" || a.type === "MemberExpression") target(n.start, a);
      },
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier") return;
        if (!WRITES.has(c.property.name) || c.object.type !== "Identifier") return;
        const name = c.object.name;
        if (!judged(name, n.start, false)) return;
        const b = m.top.get(name);
        if (b !== undefined && (collectionType(b.annotation) || collectionInit(b.init))) out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
