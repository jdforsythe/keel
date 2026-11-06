import { type ObjectExpression, type Program, type TSType, Visitor } from "oxc-parser";
import { propertyValue } from "./propertyValue.ts";

/** True when a type annotation is `typeof X.infer` or `Infer<typeof X>` for a local name of the schema. */
function annotatesSchema(t: TSType, locals: ReadonlySet<string>): boolean {
  if (t.type === "TSTypeQuery" && t.exprName.type === "TSQualifiedName") {
    const { left, right } = t.exprName;
    return left.type === "Identifier" && locals.has(left.name) && right.name === "infer";
  }
  if (t.type === "TSTypeReference" && t.typeName.type === "Identifier" && t.typeName.name === "Infer") {
    const q = t.typeArguments?.params[0];
    return q?.type === "TSTypeQuery" && q.exprName.type === "Identifier" && locals.has(q.exprName.name);
  }
  return false;
}

/**
 * Object literals that construct a value of the schema bound to `locals` in this file: a store's initial
 * state `store(X, {...})`, a form's `form(X, { initial: {...} })`, and `const v: typeof X.infer = {...}` or
 * `const v: Infer<typeof X> = {...}` (fixtures, initials). Sorted by position.
 */
export function constructorSites(program: Program, locals: ReadonlySet<string>): ObjectExpression[] {
  const out: ObjectExpression[] = [];
  if (locals.size === 0) return out;
  new Visitor({
    CallExpression: (n) => {
      const [schema, second] = n.arguments;
      if (n.callee.type !== "Identifier" || schema?.type !== "Identifier" || !locals.has(schema.name)) return;
      if (second?.type !== "ObjectExpression") return;
      if (n.callee.name === "store") out.push(second);
      if (n.callee.name === "form") {
        const init = propertyValue(second, "initial");
        if (init?.type === "ObjectExpression") out.push(init);
      }
    },
    VariableDeclarator: (n) => {
      const t = n.id.type === "Identifier" ? n.id.typeAnnotation?.typeAnnotation : undefined;
      if (t !== undefined && n.init?.type === "ObjectExpression" && annotatesSchema(t, locals)) out.push(n.init);
    },
  }).visit(program);
  return out.sort((a, b) => a.start - b.start);
}
