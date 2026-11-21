import ts from "typescript";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { applyEdits } from "./applyEdits.ts";
import { bindingTypeError } from "./bindingTypeError.ts";
import { clip } from "./clip.ts";
import { contractTypeError } from "./contractTypeError.ts";
import { lineCol } from "./lineCol.ts";
import { nodeAt } from "./nodeAt.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/**
 * `@keel/ui` base elements and their a11y-required props (k.ui), reported as E1802 when missing. `Box` needs
 * `label` only with `as` `nav` or `aside`, so only TypeScript's named missing `label` maps.
 */
const A11Y: ReadonlyMap<string, readonly string[]> = new Map([
  ["Box", ["label"]],
  ["Button", ["children"]],
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

/** The string literal value of the JSX attribute at `n`, or null. */
function attributeLiteral(n: ts.Node): string | null {
  for (let p: ts.Node | undefined = n; p !== undefined; p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      const v = p.initializer;
      if (v !== undefined && ts.isStringLiteral(v)) return v.text;
      if (
        v !== undefined &&
        ts.isJsxExpression(v) &&
        v.expression !== undefined &&
        ts.isStringLiteralLike(v.expression)
      )
        return v.expression.text;
      return null;
    }
    if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) return null;
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
 * a missing `For` key is E1001, a string where `Href` is required is E1501 (E1003 when it is a literal
 * `javascript:`/`data:` URL); one on the surface of the entries argument of `contract(...)` or the binding argument
 * of `manifest(...)` (the argument, a key, a member's literal or name value; `placeIn`) is coded by its position alone
 * (k.routes Where rules fire; `contractTypeError`, `bindingTypeError`, the binding's entry kinds read with `checker`):
 * E1155, E1510, E1506 or E1515; any other error, one inside an inline function or a schema expression included, is
 * E1751 with the message starting `TS<code>`. Returns `null` for errors Keel does not report (implicit `any` on
 * component props), for a contract key without its module prefix (the k.module pass reports that E1155) and for
 * non-error categories.
 */
export function mapTsDiagnostic(
  d: ts.Diagnostic,
  sf: ts.SourceFile,
  file: SourceFile,
  original: (pos: number) => number,
  checker: ts.TypeChecker,
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
  // JSX `<Boundary>` without `fallback` compiles with a default one (k.compiler).
  if (d.code === 2741 && /'fallback'/.test(text) && jsxTagOf(node) === "Boundary") return null;
  // A JSX `Frame` without `title` is E1802 from the rule pass (`blankLabel`), which runs without types.
  if (d.code === 2741 && /'title'/.test(text) && jsxTagOf(node) === "Frame") return null;
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
  const mapped = contractTypeError(node) ?? bindingTypeError(node, checker);
  if (mapped === "reported") return null;
  if (mapped !== null) {
    const [code, message, edits] = mapped;
    const base = diag(code, message, code === "E1506" ? "k.routes" : "k.contract");
    if (edits === undefined) return base;
    const moved = edits.map((e) => ({ ...e, start: original(e.start), end: original(e.end) }));
    return { ...base, fix: unifiedDiff(path, file.source, applyEdits(file.source, moved)) };
  }
  const tag = jsxTagOf(node);
  const missing = /Property '(\w+)' is missing/.exec(text)?.[1];
  const required = tag === null ? undefined : A11Y.get(tag);
  if (required !== undefined && missing !== undefined && required.includes(missing))
    return diag("E1802", `<${tag}> is missing a11y-required prop ${missing}`, "k.ui");
  if (required !== undefined && tag !== "Box" && MISSING_PROPS.has(d.code) && atTagName(node))
    return diag("E1802", `<${tag}> is missing a11y-required prop ${required.join(" or ")}`, "k.ui");
  if (tag === "For" && missing === "key")
    return diag("E1001", 'For needs key="<field>" naming a field of the item', "k.compiler");
  if (/not assignable to (?:parameter of )?type 'Href'/.test(text)) {
    const literal = attributeLiteral(node);
    if (literal !== null && /^\s*(?:javascript|data):/i.test(literal))
      return diag(
        "E1003",
        `literal ${literal.trim().split(":")[0]?.toLowerCase()}: URL in a URL attribute`,
        "k.compiler",
      );
    return diag("E1501", "string path where an Href is required; use the contract's href(routeId, params)", "k.router");
  }
  return diag("E1751", `TS${d.code} ${text.split("\n")[0] ?? ""}`, "k.check");
}
