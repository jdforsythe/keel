import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";
import { nodeAt } from "./nodeAt.ts";

/** `@keel/ui` base elements and their a11y-required props (k.ui), reported as E1802 when missing. */
const A11Y: ReadonlyMap<string, readonly string[]> = new Map([
  ["Button", ["children", "label"]],
  ["Checkbox", ["label"]],
  ["Heading", ["level"]],
  ["Image", ["alt", "decorative"]],
  ["Input", ["label"]],
  ["Link", ["to", "children"]],
  ["Select", ["label"]],
  ["TextArea", ["label"]],
]);
const IMPLICIT_ANY: ReadonlySet<number> = new Set([7006, 7031]);
const MISSING_PROPS: ReadonlySet<number> = new Set([2322, 2739, 2741, 2769]);
/** Compiler intrinsics whose JSX children the compiler lowers to thunks (k.compiler). */
const THUNK_CHILDREN: ReadonlySet<string> = new Set(["If", "Boundary", "Case", "Match"]);

function enclosingIntrinsic(n: ts.Node): string | null {
  for (let p: ts.Node | undefined = n.parent; p !== undefined; p = p.parent) {
    if (ts.isJsxElement(p) && n.pos >= p.openingElement.end) return p.openingElement.tagName.getText();
    if (ts.isBlock(p)) return null;
  }
  return null;
}

function atTagName(n: ts.Node): boolean {
  const p = n.parent;
  return p !== undefined && (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === n;
}

function jsxTagOf(n: ts.Node): string | null {
  for (let p: ts.Node | undefined = n; p !== undefined; p = p.parent) {
    if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) return p.tagName.getText();
    if (ts.isJsxElement(p) || ts.isBlock(p)) return null;
  }
  return null;
}

function nameOf(fn: ts.SignatureDeclaration): string | null {
  if (ts.isFunctionDeclaration(fn)) return fn.name?.text ?? "default";
  const parent = fn.parent;
  return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) ? parent.name.text : null;
}

/** Implicit `any` on a component's props parameter: the compiler types props from `Props` (k.component). */
function isComponentProps(n: ts.Node, path: string): boolean {
  if (!path.endsWith(".tsx")) return false;
  for (let p: ts.Node | undefined = n; p !== undefined; p = p.parent) {
    if (!ts.isParameter(p)) continue;
    const fn = p.parent;
    if (!ts.isFunctionLike(fn) || fn.parameters[0] !== p) return false;
    const name = nameOf(fn);
    return name !== null && /^(?:[A-Z]|default$)/.test(name);
  }
  return false;
}

/**
 * Map one TS diagnostic to a Keel diagnostic (k.check): a missing a11y prop on a base element is E1802,
 * a missing `For` key is E1001, a string where `Href` is required is E1501; any other error is E1751 with
 * the message starting `TS<code>`. Returns `null` for errors Keel does not report (implicit `any` on
 * component props) and for non-error categories.
 */
export function mapTsDiagnostic(
  d: ts.Diagnostic,
  sf: ts.SourceFile,
  file: SourceFile,
  original: (pos: number) => number,
): Diagnostic | null {
  if (d.category !== ts.DiagnosticCategory.Error) return null;
  const start = d.start ?? 0;
  const pos = original(start);
  if (pos < 0) return null;
  const node = nodeAt(sf, start);
  const path = file.path;
  if (IMPLICIT_ANY.has(d.code) && isComponentProps(node, path)) return null;
  const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  if (/is not assignable to type '\(\) => Node'/.test(text) && THUNK_CHILDREN.has(enclosingIntrinsic(node) ?? ""))
    return null;
  const { line, col } = lineCol(file.source, pos);
  const diag = (code: string, message: string, see: string): Diagnostic => ({
    kind: "diag",
    code,
    path,
    line,
    col,
    message: clip(message, 89),
    see,
  });
  const tag = jsxTagOf(node);
  const missing = /Property '(\w+)' is missing/.exec(text)?.[1];
  const required = tag === null ? undefined : A11Y.get(tag);
  if (required !== undefined && missing !== undefined && required.includes(missing))
    return diag("E1802", `<${tag}> is missing a11y-required prop ${missing}`, "k.ui");
  if (required !== undefined && MISSING_PROPS.has(d.code) && atTagName(node))
    return diag("E1802", `<${tag}> is missing a11y-required prop ${required.join(" or ")}`, "k.ui");
  if (tag === "For" && missing === "key")
    return diag("E1001", 'For needs key="<field>" naming a field of the item', "k.compiler");
  if (/not assignable to type 'Href'/.test(text))
    return diag("E1501", "string path where an Href is required; build it with href()", "k.router");
  return diag("E1751", `TS${d.code} ${text.split("\n")[0] ?? ""}`, "k.check");
}
