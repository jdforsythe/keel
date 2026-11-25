import { Visitor } from "oxc-parser";
import type {
  Argument,
  ArrowFunctionExpression,
  BindingProperty,
  Expression,
  Function as FunctionNode,
  JSXAttributeItem,
  ObjectExpression,
  Program,
  VariableDeclarator,
} from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { importTarget } from "./importTarget.ts";
import { keyName } from "./keyName.ts";
import { parseFile } from "./parseFile.ts";

/** How deep a read goes through calls and re-exports, as the factory read of k.privacy-reads goes. */
const MAX_DEPTH = 8;

type Fn = FunctionNode | ArrowFunctionExpression;
/** An expression and the scope it is read in. */
type Val = { readonly expr: Expression; readonly env: Env };
/**
 * A scope: `vars` a called function's parameters (standing for the call's arguments) and body `const`s, `parent` the
 * scope the function was made in (its closure); `active` the functions being read on the way here.
 */
type Env = {
  readonly file: SourceFile;
  readonly vars: ReadonlyMap<string, Val>;
  readonly parent: Env | undefined;
  readonly depth: number;
  readonly active: ReadonlySet<string>;
};
/** A file's names: the first parameters of its top-level functions (a component's props), and its id holders. */
type Names = { readonly params: ReadonlySet<string>; readonly built: ReadonlySet<string> };

/** `x as T`, `x satisfies T`, `x!` and `(x)` read through. */
function unwrap(e: Expression): Expression {
  let x = e;
  while (
    x.type === "TSAsExpression" ||
    x.type === "TSSatisfiesExpression" ||
    x.type === "TSNonNullExpression" ||
    x.type === "ParenthesizedExpression"
  )
    x = x.expression;
  return x;
}

/** Whether a destructuring property reads the key `id`. */
const idKey = (p: BindingProperty): boolean =>
  !p.computed &&
  ((p.key.type === "Identifier" && p.key.name === "id") || (p.key.type === "Literal" && p.key.value === "id"));

const isFn = (e: Expression | null | undefined): e is Fn =>
  e !== null && e !== undefined && (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression");

/** The expressions `fn` returns (none of a nested function's); `null` for a bare `return`. */
function returned(fn: Fn, program: Program): (Expression | null)[] {
  if (fn.type === "ArrowFunctionExpression" && fn.expression && fn.body.type !== "BlockStatement") return [fn.body];
  const body = fn.body;
  if (body === null) return [];
  const nested: { start: number; end: number }[] = [];
  const out: { at: number; arg: Expression | null }[] = [];
  const inner = (n: { start: number; end: number }): void => {
    if (n.start > body.start && n.end <= body.end) nested.push(n);
  };
  new Visitor({
    FunctionDeclaration: inner,
    FunctionExpression: inner,
    ArrowFunctionExpression: inner,
    ReturnStatement: (r) => {
      if (r.start >= body.start && r.end <= body.end) out.push({ at: r.start, arg: r.argument });
    },
  }).visit(program);
  return out.filter((r) => !nested.some((n) => r.at > n.start && r.at < n.end)).map((r) => r.arg);
}

/**
 * The reader E1161 judges a library element's `id` with (k.library Ids): over `files` (the checked files, where they
 * lie) and `entries` (each library specifier to the file its `exports` give). An `id` is built from its component's
 * `id` prop when it is `<p>.id` (`<p>` a top-level function's first parameter), a name bound to such a value, a
 * template literal with such an expression, a conditional whose two branches are, or a call whose callee the reader
 * reads (a function of the file, a closure, an import from the library's own files or another library, a member of an
 * object it reads back to a literal or a call) and every expression it returns is, its parameters standing for the
 * arguments and closure names read where they are bound. A function met again while its read is open, or more than
 * eight calls deep, is not read. Anything else is not built.
 */
export function idReader(
  files: readonly SourceFile[],
  entries: ReadonlyMap<string, string>,
): {
  readonly jsxBad: (attributes: readonly JSXAttributeItem[], file: SourceFile) => boolean;
  readonly callBad: (arg: Argument | undefined, file: SourceFile) => boolean;
} {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const namesOf = new Map<string, Names>();
  const root = (file: SourceFile): Env => ({ file, vars: new Map(), parent: undefined, depth: 0, active: new Set() });
  const program = (file: SourceFile): Program => parseFile(file).program;

  const lookup = (name: string, env: Env | undefined): Val | undefined => {
    for (let e = env; e !== undefined; e = e.parent) {
      const v = e.vars.get(name);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  /** The `const` initializers and function declarations of `file` by name, anywhere in it; a name held twice is none. */
  const decls = new Map<string, Map<string, Expression | Fn | null>>();
  const declsOf = (file: SourceFile): Map<string, Expression | Fn | null> => {
    const held = decls.get(file.path);
    if (held !== undefined) return held;
    const out = new Map<string, Expression | Fn | null>();
    const put = (n: string, x: Expression | Fn): void => void out.set(n, out.has(n) ? null : x);
    new Visitor({
      VariableDeclarator: (d) => {
        if (d.id.type === "Identifier" && d.init !== null && d.init !== undefined) put(d.id.name, d.init);
      },
      FunctionDeclaration: (f) => {
        if (f.id !== null && f.id !== undefined && f.body !== null) put(f.id.name, f);
      },
    }).visit(program(file));
    decls.set(file.path, out);
    return out;
  };

  /** The function `file` exports as `name`: declared there, a local exported under it, a re-export or `export *`. */
  const exported = (name: string, file: SourceFile, hops: number): { fn: Fn; file: SourceFile } | undefined => {
    if (hops > MAX_DEPTH) return undefined;
    for (const st of program(file).body) {
      if (st.type === "ExportDefaultDeclaration" && name === "default") {
        const d = st.declaration;
        if (d.type === "FunctionDeclaration" || d.type === "FunctionExpression" || d.type === "ArrowFunctionExpression")
          return { fn: d, file };
        if (d.type === "Identifier") return local(d.name, file, hops + 1);
      } else if (st.type === "ExportNamedDeclaration" && st.declaration !== null && st.declaration !== undefined) {
        const d = st.declaration;
        const declares =
          (d.type === "FunctionDeclaration" && d.id?.name === name) ||
          (d.type === "VariableDeclaration" &&
            d.declarations.some((v) => v.id.type === "Identifier" && v.id.name === name));
        if (declares) return local(name, file, hops + 1);
      } else if (st.type === "ExportNamedDeclaration")
        for (const sp of st.specifiers) {
          const out = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
          const inner = sp.local.type === "Identifier" ? sp.local.name : sp.local.value;
          if (out !== name) continue;
          if (st.source === null) return local(inner, file, hops + 1);
          const target = fileOf(file, st.source.value);
          return target === undefined ? undefined : exported(inner, target, hops + 1);
        }
      else if (st.type === "ExportAllDeclaration" && st.exported === null) {
        const target = fileOf(file, st.source.value);
        const hit = target === undefined ? undefined : exported(name, target, hops + 1);
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  };

  /** The file `spec` names from `from`: a relative path among the files, or a library's entry. */
  const fileOf = (from: SourceFile, spec: string): SourceFile | undefined => {
    const lib = entries.get(spec);
    return lib !== undefined ? byPath.get(lib) : importTarget(from.path, spec, files);
  };

  /** The function `name` is in `file`: declared or bound to a `const` there (once), or imported by name. */
  const local = (name: string, file: SourceFile, hops: number): { fn: Fn; file: SourceFile } | undefined => {
    if (hops > MAX_DEPTH) return undefined;
    for (const st of program(file).body)
      if (st.type === "ImportDeclaration" && st.importKind !== "type")
        for (const sp of st.specifiers)
          if (sp.local.name === name) {
            const target = fileOf(file, st.source.value);
            const imported =
              sp.type === "ImportDefaultSpecifier"
                ? "default"
                : sp.type === "ImportSpecifier"
                  ? sp.imported.type === "Identifier"
                    ? sp.imported.name
                    : sp.imported.value
                  : undefined;
            return target === undefined || imported === undefined ? undefined : exported(imported, target, hops + 1);
          }
    const d = declsOf(file).get(name);
    if (d === null || d === undefined) return undefined;
    if (d.type === "FunctionDeclaration") return { fn: d, file };
    const init = unwrap(d);
    return isFn(init) ? { fn: init, file } : undefined;
  };

  /** The function `callee` names in `env`, with the scope it was made in. */
  const fnOf = (callee: Expression, env: Env): { fn: Fn; env: Env } | undefined => {
    const x = unwrap(callee);
    if (isFn(x)) return { fn: x, env };
    if (x.type === "Identifier") {
      const v = lookup(x.name, env);
      if (v !== undefined) return fnOf(v.expr, v.env);
      const hit = local(x.name, env.file, 0);
      return hit === undefined ? undefined : { fn: hit.fn, env: root(hit.file) };
    }
    if (x.type === "MemberExpression" && !x.computed && x.property.type === "Identifier") {
      const o = objectOf(x.object, env);
      const p = o === undefined ? undefined : propertyOf(o.obj, x.property.name);
      return p === undefined || o === undefined ? undefined : fnOf(p, o.env);
    }
    return undefined;
  };

  /** The value property `name` of an object literal holds, when no later spread may replace it. */
  const propertyOf = (o: ObjectExpression, name: string): Expression | undefined => {
    let hit: Expression | undefined;
    for (const p of o.properties) {
      if (p.type !== "Property") hit = undefined;
      else if (keyName(p) === name) hit = p.value;
    }
    return hit;
  };

  /** A scope for reading a call of `f`: its parameters bound to `args` read in `caller`, its body `const`s in it. */
  const enter = (f: { fn: Fn; env: Env }, args: readonly Argument[], caller: Env): Env | undefined => {
    const id = `${f.env.file.path}:${f.fn.start}`;
    if (f.env.active.has(id) || caller.active.has(id) || caller.depth >= MAX_DEPTH) return undefined;
    const vars = new Map<string, Val>();
    const env: Env = {
      file: f.env.file,
      vars,
      parent: f.env,
      depth: caller.depth + 1,
      active: new Set([...caller.active, ...f.env.active, id]),
    };
    f.fn.params.forEach((p, i) => {
      const arg = args[i];
      const value = arg === undefined || arg.type === "SpreadElement" ? undefined : arg;
      const q = p.type === "AssignmentPattern" ? p.left : p;
      if (q.type !== "Identifier") return;
      if (value !== undefined) vars.set(q.name, { expr: value, env: caller });
      else if (p.type === "AssignmentPattern") vars.set(q.name, { expr: p.right, env });
    });
    const body = f.fn.body;
    if (body !== null && body.type === "BlockStatement")
      for (const st of body.body)
        if (st.type === "VariableDeclaration" && st.kind === "const")
          for (const v of st.declarations)
            if (v.id.type === "Identifier" && v.init !== null && v.init !== undefined)
              vars.set(v.id.name, { expr: v.init, env });
    return env;
  };

  /** The object literal `e` reads back to in `env` (through names, `const`s and calls), with its scope. */
  const objectOf = (e: Expression, env: Env): { obj: ObjectExpression; env: Env } | undefined => {
    const x = unwrap(e);
    if (x.type === "ObjectExpression") return { obj: x, env };
    if (x.type === "Identifier") {
      const v = lookup(x.name, env);
      if (v !== undefined) return objectOf(v.expr, v.env);
      const d = declsOf(env.file).get(x.name);
      return d === null || d === undefined || d.type === "FunctionDeclaration" || isFn(d)
        ? undefined
        : objectOf(d, root(env.file));
    }
    if (x.type === "CallExpression") {
      const f = fnOf(x.callee, env);
      const inner = f === undefined ? undefined : enter(f, x.arguments, env);
      if (f === undefined || inner === undefined) return undefined;
      for (const r of returned(f.fn, program(f.env.file))) {
        const hit = r === null ? undefined : objectOf(r, inner);
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  };

  /** A file's names (`Names`), to a fixed point over its `const`s. */
  const names = (file: SourceFile): Names => {
    const held = namesOf.get(file.path);
    if (held !== undefined) return held;
    const params = new Set<string>();
    const holders = new Set<string>();
    const out: Names = { params, built: holders };
    namesOf.set(file.path, out);
    const param = (p: Fn["params"][number] | undefined): void => {
      const q = p === undefined ? undefined : p.type === "AssignmentPattern" ? p.left : p;
      if (q?.type === "Identifier") params.add(q.name);
      if (q?.type === "ObjectPattern")
        for (const prop of q.properties)
          if (prop.type === "Property" && idKey(prop) && prop.value.type === "Identifier") holders.add(prop.value.name);
    };
    for (const st of program(file).body) {
      const d = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
      if (d?.type === "FunctionDeclaration") param(d.params[0]);
      else if (
        d !== null &&
        d !== undefined &&
        (d.type === "ArrowFunctionExpression" || d.type === "FunctionExpression")
      )
        param(d.params[0]);
      else if (d?.type === "VariableDeclaration")
        for (const v of d.declarations) {
          const init = v.init === null || v.init === undefined ? undefined : unwrap(v.init);
          if (isFn(init)) param(init.params[0]);
        }
    }
    const pairs: VariableDeclarator[] = [];
    new Visitor({ VariableDeclarator: (d) => void pairs.push(d) }).visit(program(file));
    for (let grew = true; grew; ) {
      grew = false;
      for (const d of pairs) {
        const init = d.init === null || d.init === undefined ? undefined : unwrap(d.init);
        if (init === undefined) continue;
        const add = (n: string): void => {
          if (!holders.has(n)) {
            holders.add(n);
            grew = true;
          }
        };
        if (d.id.type === "Identifier" && !holders.has(d.id.name) && built(init, root(file))) add(d.id.name);
        if (d.id.type === "ObjectPattern" && init.type === "Identifier" && params.has(init.name))
          for (const prop of d.id.properties)
            if (prop.type === "Property" && idKey(prop) && prop.value.type === "Identifier") add(prop.value.name);
      }
    }
    return out;
  };

  /** Whether `e`, read in `env`, names a component's props: an unbound top-level function's first parameter. */
  const propsRef = (e: Expression, env: Env): boolean => {
    const x = unwrap(e);
    if (x.type !== "Identifier") return false;
    const v = lookup(x.name, env);
    return v === undefined ? names(env.file).params.has(x.name) : propsRef(v.expr, v.env);
  };

  /** Whether `e`, read in `env`, is built from a component's `id` prop. */
  const built = (e: Expression, env: Env): boolean => {
    const x = unwrap(e);
    if (x.type === "Identifier") {
      const v = lookup(x.name, env);
      return v === undefined ? names(env.file).built.has(x.name) : built(v.expr, v.env);
    }
    if (x.type === "MemberExpression") {
      if (x.computed || x.property.type !== "Identifier" || x.property.name !== "id") return false;
      if (propsRef(x.object, env)) return true;
      const o = objectOf(x.object, env);
      const p = o === undefined ? undefined : propertyOf(o.obj, "id");
      return p !== undefined && o !== undefined && built(p, o.env);
    }
    if (x.type === "TemplateLiteral") return x.expressions.some((y) => built(y, env));
    if (x.type === "ConditionalExpression") return built(x.consequent, env) && built(x.alternate, env);
    if (x.type === "CallExpression") {
      const f = fnOf(x.callee, env);
      const inner = f === undefined ? undefined : enter(f, x.arguments, env);
      if (f === undefined || inner === undefined) return false;
      const out = returned(f.fn, program(f.env.file));
      return out.length > 0 && out.every((r) => r !== null && built(r, inner));
    }
    return false;
  };

  /**
   * The `id` an object literal gives after its properties in order, with its scope: undefined for none, `null` for one
   * a spread check cannot read may have set or replaced.
   */
  const objectId = (o: ObjectExpression, env: Env): Val | null | undefined => {
    let id: Val | null | undefined;
    for (const p of o.properties) {
      if (p.type === "Property") {
        if (keyName(p) === "id") id = { expr: p.value, env };
      } else {
        const inner = objectOf(p.argument, env);
        const got = inner === undefined ? null : objectId(inner.obj, inner.env);
        if (got !== undefined) id = got;
      }
    }
    return id;
  };

  const bad = (id: Val | null | undefined): boolean => id === null || id === undefined || !built(id.expr, id.env);

  return {
    jsxBad: (attributes, file) => {
      const env = root(file);
      let id: Val | null | undefined;
      for (const a of attributes) {
        if (a.type === "JSXSpreadAttribute") {
          const inner = objectOf(a.argument, env);
          const got = inner === undefined ? null : objectId(inner.obj, inner.env);
          if (got !== undefined) id = got;
        } else if (a.name.type === "JSXIdentifier" && a.name.name === "id") {
          const v = a.value;
          id =
            v !== null && v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression"
              ? { expr: v.expression, env }
              : null;
        }
      }
      return bad(id);
    },
    callBad: (arg, file) => {
      if (arg === undefined || arg.type === "SpreadElement") return true;
      const o = objectOf(arg, root(file));
      return o === undefined || bad(objectId(o.obj, o.env));
    },
  };
}
