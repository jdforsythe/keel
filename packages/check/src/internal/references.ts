import { type BindingPattern, type ParamPattern, type Program, Visitor } from "oxc-parser";
import type { Ref } from "./Ref.ts";
import type { RefTable } from "./RefTable.ts";

type Span = { start: number; end: number };

function namesOf(p: BindingPattern | null | undefined, out: Set<string>): void {
  if (p === null || p === undefined) return;
  if (p.type === "Identifier") out.add(p.name);
  else if (p.type === "AssignmentPattern") namesOf(p.left, out);
  else if (p.type === "ArrayPattern")
    for (const e of p.elements) namesOf(e?.type === "RestElement" ? e.argument : e, out);
  else if (p.type === "ObjectPattern")
    for (const q of p.properties) namesOf(q.type === "RestElement" ? q.argument : q.value, out);
}

const memo = new WeakMap<Program, RefTable>();

/**
 * Identifier reads (not member properties, object keys, labels, types, or declarations) and declared names.
 * Name-based, no scope resolution: rules use `declared` to skip names a file shadows anywhere.
 */
export function references(program: Program): RefTable {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  const excluded: Span[] = [];
  const all: Ref[] = [];
  const declared = new Set<string>();
  const skip = (n: Span): void => void excluded.push({ start: n.start, end: n.end });
  const params = (ps: readonly ParamPattern[]): void => {
    for (const p of ps) {
      if (p.type === "TSParameterProperty") namesOf(p.parameter, declared);
      else if (p.type === "RestElement") namesOf(p.argument, declared);
      else namesOf(p, declared);
      skip(p);
    }
  };
  new Visitor({
    ImportDeclaration: (n) => {
      for (const s of n.specifiers) declared.add(s.local.name);
      skip(n);
    },
    VariableDeclarator: (n) => {
      namesOf(n.id, declared);
      skip(n.id);
    },
    FunctionDeclaration: (n) => {
      if (n.id) {
        declared.add(n.id.name);
        skip(n.id);
      }
      params(n.params);
    },
    FunctionExpression: (n) => {
      if (n.id) skip(n.id);
      params(n.params);
    },
    ArrowFunctionExpression: (n) => params(n.params),
    CatchClause: (n) => {
      if (n.param) {
        namesOf(n.param, declared);
        skip(n.param);
      }
    },
    ClassDeclaration: (n) => {
      if (n.id) {
        declared.add(n.id.name);
        skip(n.id);
      }
    },
    MemberExpression: (n) => {
      if (!n.computed) skip(n.property);
    },
    Property: (n) => {
      if (!n.computed && !n.shorthand) skip(n.key);
    },
    MethodDefinition: (n) => {
      if (!n.computed) skip(n.key);
    },
    PropertyDefinition: (n) => {
      if (!n.computed) skip(n.key);
    },
    LabeledStatement: (n) => skip(n.label),
    TSTypeAnnotation: skip,
    TSTypeParameterInstantiation: skip,
    TSTypeParameterDeclaration: skip,
    TSInterfaceDeclaration: skip,
    TSTypeAliasDeclaration: skip,
    Identifier: (n) => void all.push({ name: n.name, start: n.start, end: n.end }),
  }).visit(program);
  const refs = all
    .filter((r) => !excluded.some((e) => r.start >= e.start && r.end <= e.end))
    .sort((x, y) => x.start - y.start);
  const out: RefTable = { refs, declared };
  memo.set(program, out);
  return out;
}
