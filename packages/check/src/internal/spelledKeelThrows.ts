import { type Node, type Program, Visitor } from "oxc-parser";
import { localNames } from "./modules/localNames.ts";
import { throwOwners } from "./throwOwners.ts";

type Span = { readonly start: number; readonly end: number };
type Fn = Span & { readonly failure: string | undefined };

/**
 * E1451's fix sites without the type pass (k.fixes Per code), read from what the file spells: the start offsets of
 * the `throw <name>` statements directly in a function whose declared return type is `Result<T, E>` of
 * `@keel/schema` (`Promise<Result<T, E>>` for an `async` one), where `<name>` is declared in the file with the type
 * annotation `E` itself, outside every `try` block with a `catch` in that function (`throwOwners`). `Result`'s bound makes `E` a
 * `KeelError`, so `return err(<name>)` compiles; any other `throw` waits for the type pass (`keelThrows`).
 */
export function spelledKeelThrows(ast: Program, source: string): ReadonlySet<number> {
  const results = localNames(ast, "Result", "@keel/schema");
  const out = new Set<number>();
  if (results.size === 0) return out;
  const text = (n: Span): string => source.slice(n.start, n.end).replace(/\s+/g, "");
  const failureOf = (t: Node | null | undefined, async: boolean): string | undefined => {
    if (t?.type !== "TSTypeReference" || t.typeName.type !== "Identifier") return undefined;
    if (async) return t.typeName.name === "Promise" ? failureOf(t.typeArguments?.params[0], false) : undefined;
    const e = t.typeArguments?.params[1];
    return results.has(t.typeName.name) && e !== undefined ? text(e) : undefined;
  };
  const fns: Fn[] = [];
  const caught: Span[] = [];
  const declared = new Map<string, string>();
  const throws: { at: number; arg: Node }[] = [];
  const fn = (n: Node): void => {
    if (n.type !== "FunctionDeclaration" && n.type !== "FunctionExpression" && n.type !== "ArrowFunctionExpression")
      return;
    fns.push({ start: n.start, end: n.end, failure: failureOf(n.returnType?.typeAnnotation, n.async) });
  };
  const note = (id: Node): void => {
    const t = id.type === "Identifier" ? id.typeAnnotation?.typeAnnotation : undefined;
    if (id.type !== "Identifier") return;
    // A name declared twice with different annotations is read as neither.
    const was = declared.get(id.name);
    const now = t === undefined ? "" : text(t);
    declared.set(id.name, was === undefined || was === now ? now : "");
  };
  new Visitor({
    FunctionDeclaration: (n) => {
      fn(n);
      n.params.forEach(note);
    },
    FunctionExpression: (n) => {
      fn(n);
      n.params.forEach(note);
    },
    ArrowFunctionExpression: (n) => {
      fn(n);
      n.params.forEach(note);
    },
    VariableDeclarator: (n) => note(n.id),
    TryStatement: (n) => {
      if (n.handler !== null) caught.push(n.block);
    },
    ThrowStatement: (n) => void throws.push({ at: n.start, arg: n.argument }),
  }).visit(ast);
  const named = new Map(throws.flatMap((t) => (t.arg.type === "Identifier" ? [[t.at, t.arg.name]] : [])));
  for (const { at, owner } of throwOwners([...named.keys()], fns, caught)) {
    const name = named.get(at);
    if (
      owner.failure !== undefined &&
      owner.failure !== "" &&
      name !== undefined &&
      declared.get(name) === owner.failure
    )
      out.add(at);
  }
  return out;
}
