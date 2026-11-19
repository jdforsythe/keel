import ts from "typescript";
import type { Edit } from "../types/Edit.ts";

const REFUSED = ["component", "errorElement", "title", "layout"];

const nameOf = (p: ts.ObjectLiteralElement): string =>
  p.name !== undefined && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : "";

/**
 * The Keel code for a TS error at the key (or `api: true`) of an entry literal of `manifest({...})` (k.api, k.router), as
 * `[code, message, edits]`: E1510 for an API entry (`api: true`) with `component`, `errorElement`, `title` or `layout`
 * (the edits remove them) or without `path`, and for an entry with neither `component` nor `api`; E1508 when `text`
 * (the TS message) is about the `redirect` of a page's or layout's `guard`. Null for any other error or entry.
 */
export function manifestEntry(node: ts.Node, text: string): [string, string, Edit[]?] | null {
  // TS reports a union mismatch at the entry's key, or at `api: true` when it picked the page arm.
  const up = node.parent;
  const viaApi = up !== undefined && ts.isPropertyAssignment(up) && nameOf(up) === "api";
  const p = viaApi ? up.parent.parent : up;
  if (p === undefined || !ts.isPropertyAssignment(p) || (!viaApi && p.name !== node)) return null;
  const call = p.parent.parent;
  const entry = p.initializer;
  if (!ts.isObjectLiteralExpression(entry) || !ts.isCallExpression(call) || call.arguments[0] !== p.parent) return null;
  if (call.expression.getText() !== "manifest" || entry.properties.some(ts.isSpreadAssignment)) return null;
  const props = entry.properties;
  const names = props.map(nameOf);
  const id = nameOf(p);
  const api = props.find((q) => nameOf(q) === "api");
  if (api !== undefined && ts.isPropertyAssignment(api) && api.initializer.kind === ts.SyntaxKind.TrueKeyword) {
    const refused = names.filter((n) => REFUSED.includes(n));
    // A refused member goes with the comma after it, or before it when no kept member follows.
    const kept = Math.max(...names.map((n, i) => (REFUSED.includes(n) ? -1 : i)));
    const edits: Edit[] = [];
    props.forEach((q, i) => {
      const [prev, next] = [props[i - 1], props[i + 1]];
      if (!REFUSED.includes(names[i] ?? "")) return;
      if (i < kept && next !== undefined) edits.push({ start: q.getStart(), end: next.getStart(), text: "" });
      else if (prev !== undefined) edits.push({ start: prev.end, end: q.end, text: "" });
    });
    if (refused.length > 0) return ["E1510", `${id}: an API route has no ${refused.join(", ")}`, edits];
    if (!names.includes("path")) return ["E1510", `${id}: an API route needs a path`];
  } else if (api === undefined && !names.includes("component"))
    return ["E1510", `${id}: an entry needs component, or api: true`];
  else if (api === undefined && names.includes("guard") && text.includes("'redirect'"))
    return ["E1508", `${id}: a guard without redirect guards API routes only`];
  return null;
}
