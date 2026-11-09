import type {
  CallExpression,
  Expression,
  ImportDeclaration,
  JSXElement,
  JSXFragment,
  LogicalExpression,
  Program,
} from "oxc-parser";
import type { FnInfo } from "./FnInfo.ts";
import type { IdentRef } from "./IdentRef.ts";
import type { IntrinsicKind } from "./IntrinsicKind.ts";
import type { ReactiveDecl } from "./ReactiveDecl.ts";
import type { Span } from "./Span.ts";

/** Everything the lowering and the rules need from one parsed file, collected in a single visit. */
export type Analysis = {
  path: string;
  source: string;
  /** File name without directories and extension; prefix of derived element ids. */
  stem: string;
  /** Root-relative path without extension, `/` as `.`: prefix of derived element ids (`src.cart.Add`). */
  idPrefix: string;
  program: Program;
  parseErrors: { message: string; start: number }[];
  /** All JSX elements and fragments, sorted by start. */
  jsx: (JSXElement | JSXFragment)[];
  imports: ImportDeclaration[];
  /** Local name -> intrinsic, for names imported from `@keel/runtime-dom`. */
  intrinsics: Map<string, IntrinsicKind>;
  functions: FnInfo[];
  /** Identifier reads, sorted by start. */
  idents: IdentRef[];
  identsByName: Map<string, IdentRef[]>;
  /** Declared name -> spans of the scopes that declare it (function, block, catch, program). */
  decls: Map<string, Span[]>;
  /** Declared names (in params, variable and catch patterns, but not their defaults) and imports: not reads. */
  bindings: Span[];
  /** Member accesses by property name (non-computed), for raw-HTML detection. */
  members: (Span & { name: string })[];
  logicals: LogicalExpression[];
  reactive: ReactiveDecl[];
  /** `const X = <expr>` initializers by name, first declaration wins (schema lookups). */
  consts: Map<string, Expression>;
  /** `effect(...)` calls. */
  effects: Span[];
  /** Calls whose callee is a plain identifier (`Button({ … })`), in source order. */
  calls: CallExpression[];
};
