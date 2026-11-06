import ts from "typescript";
import type { Annotated } from "./Annotated.ts";

const ALIAS = "__KeelProps";
const TAIL = `\nimport type { Infer as __KeelInfer } from "@keel/schema";\ntype ${ALIAS} = __KeelInfer<typeof Props>;\n`;

function hasPropsSchema(sf: ts.SourceFile): boolean {
  return sf.statements.some(
    (s) =>
      ts.isVariableStatement(s) &&
      s.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === "Props" && d.initializer !== undefined,
      ),
  );
}

function isComponent(name: string | undefined, exportedDefault: boolean): boolean {
  return exportedDefault || (name !== undefined && /^[A-Z]/.test(name));
}

/**
 * The compiler types a component's props from the file's `Props` schema (k.component). For the type check of
 * a `.tsx` file declaring `Props`, add `: Infer<typeof Props>` to each component's untyped props parameter
 * and append the alias at the end, so original offsets map back exactly.
 */
export function annotateProps(path: string, source: string): Annotated {
  const same: Annotated = { text: source, original: (pos) => pos };
  if (!path.endsWith(".tsx")) return same;
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  if (!hasPropsSchema(sf)) return same;
  const at: number[] = [];
  const consider = (fn: ts.SignatureDeclaration, name: string | undefined, exportedDefault: boolean): void => {
    const p = fn.parameters[0];
    if (p === undefined || p.type !== undefined || !isComponent(name, exportedDefault)) return;
    at.push(p.name.getEnd());
  };
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s)) {
      const isDefault = s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) === true;
      consider(s, s.name?.text, isDefault);
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const init = d.initializer;
        if (
          init !== undefined &&
          ts.isIdentifier(d.name) &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        )
          consider(init, d.name.text, false);
      }
    }
  }
  if (at.length === 0) return same;
  const insert = `: ${ALIAS}`;
  let text = "";
  let from = 0;
  for (const a of at) {
    text += source.slice(from, a) + insert;
    from = a;
  }
  text += source.slice(from) + TAIL;
  const original = (pos: number): number => {
    let shift = 0;
    for (const a of at) {
      const v = a + shift;
      if (pos < v) break;
      if (pos < v + insert.length) return a;
      shift += insert.length;
    }
    const o = pos - shift;
    return o > source.length ? -1 : o;
  };
  return { text, original };
}
