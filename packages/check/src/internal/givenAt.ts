import { type ResolvedGlobals, unwrapExpression } from "@keel/compiler/internal";
import {
  type Argument,
  type BindingPattern,
  type BindingRestElement,
  type BlockStatement,
  type Expression,
  type Program,
  Visitor,
} from "oxc-parser";
import type { Given } from "./Given.ts";

/** Methods that put their arguments into the receiver. */
const ADDS: ReadonlySet<string> = new Set(["push", "unshift", "set", "add", "append"]);

function add<T>(to: Map<string, T[]>, name: string, x: T): void {
  const list = to.get(name);
  if (list === undefined) to.set(name, [x]);
  else list.push(x);
}

/**
 * The values the locals of `program` are given, read by E1112. `live(name, use)` is what the local `name` read at
 * offset `use` may hold: its initializers, assignments, `for...of` heads, member writes (`o.k = v`, under the first
 * key of the chain), and the arguments of `push`, `unshift`, `set`, `add` or `append` on it and of `Object.assign`
 * to it. A `name = value` statement in a block around the read, ending before it, hides every earlier value but
 * the member writes and mutations. `under(key, name, use)` is whether an object pattern binds that local from the
 * property `key`.
 */
export function givenAt(
  program: Program,
  g: ResolvedGlobals,
): {
  readonly live: (name: string, use: number) => readonly Given[];
  readonly under: (key: string, name: string, use: number) => boolean;
} {
  const values = new Map<string, Given[]>();
  const kills = new Map<string, { at: number; end: number; to: number }[]>();
  const keyed = new Map<string, { at: number; key: string }[]>();
  /** Gives each name `p` binds the value `v`, under `key`: the first object key on the way to the name. */
  const bind = (p: BindingPattern | BindingRestElement, v: Expression, key: string | null | undefined): void => {
    if (p.type === "Identifier") add(values, p.name, { at: p.start, v, key, field: undefined, kept: false });
    else if (p.type === "ObjectPattern")
      for (const x of p.properties) {
        if (x.type === "RestElement") bind(x.argument, v, key ?? null);
        else bind(x.value, v, key !== undefined ? key : x.computed || x.key.type !== "Identifier" ? null : x.key.name);
      }
    else if (p.type === "ArrayPattern") {
      for (const x of p.elements) if (x !== null) bind(x, v, key ?? null);
    } else bind(p.type === "RestElement" ? p.argument : p.left, v, key ?? null);
  };
  /** Puts `v` into the local the member chain `to` starts at: the local itself, or the first field of the chain. */
  const put = (to: Expression, v: Argument, field?: string | null): void => {
    const x = unwrapExpression(to);
    if (x.type === "MemberExpression") put(x.object, v, x.computed ? g.constString(x.property) : x.property.name);
    else if (x.type === "Identifier")
      add(values, x.name, {
        at: x.start,
        v: v.type === "SpreadElement" ? v.argument : v,
        key: null,
        field,
        kept: true,
      });
  };
  const block = (n: Program | BlockStatement): void => {
    for (const st of n.body) {
      const x = st.type === "ExpressionStatement" ? st.expression : null;
      if (x?.type === "AssignmentExpression" && x.operator === "=" && x.left.type === "Identifier")
        add(kills, x.left.name, { at: x.left.start, end: st.end, to: n.end });
    }
  };
  new Visitor({
    Program: block,
    BlockStatement: block,
    VariableDeclarator: (n) => {
      if (n.init !== null) bind(n.id, n.init, undefined);
    },
    ForOfStatement: (n) => {
      if (n.left.type === "VariableDeclaration") for (const d of n.left.declarations) bind(d.id, n.right, null);
    },
    ObjectPattern: (p) => {
      for (const x of p.properties) {
        if (x.type === "RestElement" || x.computed || x.key.type !== "Identifier") continue;
        const b = x.value.type === "AssignmentPattern" ? x.value.left : x.value;
        if (b.type === "Identifier") add(keyed, b.name, { at: b.start, key: x.key.name });
      }
    },
    AssignmentExpression: (n) => {
      if (n.left.type === "Identifier") bind(n.left, n.right, undefined);
      else if (n.left.type === "MemberExpression") put(n.left, n.right);
    },
    CallExpression: (n) => {
      const c = n.callee;
      const [to, ...from] = n.arguments;
      if (c.type === "MemberExpression" && !c.computed && ADDS.has(c.property.name))
        for (const a of n.arguments) put(c.object, a);
      else if (to !== undefined && to.type !== "SpreadElement" && g.resolve(c)?.join(".") === "Object.assign")
        for (const a of from) put(to, a);
    },
  }).visit(program);
  const of = <T extends { at: number }>(all: Map<string, T[]>, name: string, use: number): T[] =>
    (all.get(name) ?? []).filter((x) => g.sameBinding(name, x.at, use));
  return {
    live: (name, use) => {
      // A statement of an enclosing block that ends before the read writes the binding the read sees.
      const hidden = (kills.get(name) ?? []).filter((k) => k.end <= use && use < k.to);
      const last = Math.max(-1, ...hidden.map((k) => k.at));
      return of(values, name, use).filter((x) => x.kept || x.at >= last);
    },
    under: (key, name, use) => of(keyed, name, use).some((k) => k.key === key),
  };
}
