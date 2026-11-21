import type { ArrayExpression, Program } from "oxc-parser";
import type { RedactLiteral } from "./RedactLiteral.ts";
import { propValue } from "./propValue.ts";
import { stringLiteral } from "./stringLiteral.ts";
import { unwrap } from "./unwrap.ts";

/** The manifest `id` literal and the string entries of `std['@keel/std-sessions'].redact` and `.expose` of the default `module({...})`. */
export function redactLiterals(ast: Program): { id: string | undefined; literals: RedactLiteral[] } {
  const none = { id: undefined, literals: [] };
  const def = ast.body.find((s) => s.type === "ExportDefaultDeclaration");
  const d = def?.declaration;
  if (d === undefined || d.type !== "CallExpression") return none;
  const arg = d.arguments[0];
  const obj = arg === undefined || arg.type === "SpreadElement" ? undefined : unwrap(arg);
  if (obj === undefined || obj.type !== "ObjectExpression") return none;
  const id = stringLiteral(propValue(obj, "id"));
  const std = propValue(obj, "std");
  const cfg = std === undefined ? undefined : unwrap(std);
  const mine = cfg?.type === "ObjectExpression" ? propValue(cfg, "@keel/std-sessions") : undefined;
  const mineObj = mine === undefined ? undefined : unwrap(mine);
  const literals: RedactLiteral[] = [];
  for (const key of ["redact", "expose"]) {
    const red = mineObj?.type === "ObjectExpression" ? propValue(mineObj, key) : undefined;
    const arr = red === undefined ? undefined : unwrap(red);
    if (arr !== undefined && arr.type === "ArrayExpression") collect(arr, key, literals);
  }
  return { id, literals: literals.sort((a, b) => a.start - b.start) };
}

function collect(arr: ArrayExpression, list: string, literals: RedactLiteral[]): void {
  const els = arr.elements;
  els.forEach((el, i) => {
    const value = el === null ? undefined : stringLiteral(el.type === "SpreadElement" ? undefined : el);
    if (el === null || value === undefined) return;
    const next = els[i + 1];
    const prev = els[i - 1];
    let rmStart = el.start;
    let rmEnd = el.end;
    if (els.length === 1) {
      rmStart = arr.start + 1;
      rmEnd = arr.end - 1;
    } else if (next !== undefined && next !== null) rmEnd = next.start;
    else if (prev !== undefined && prev !== null) rmStart = prev.end;
    literals.push({ list, value, start: el.start, end: el.end, rmStart, rmEnd });
  });
}
