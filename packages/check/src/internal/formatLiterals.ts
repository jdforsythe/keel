import { s } from "@keel/schema";
import ts from "typescript";

/** Where `@keel/schema` declares `formatLiteral`: the source file, or its built declaration file. */
const DECLARED_IN = /\/schema\/(?:src|dist\/src)\/formatLiteral\.(?:d\.)?ts$/;

/** The format names `N` the type of a `formatLiteral` call carries: the keys of its `__format` brand. */
function namesOf(call: ts.CallExpression, checker: ts.TypeChecker): string[] {
  const returned = checker.getResolvedSignature(call)?.getReturnType();
  const brand = returned === undefined ? undefined : checker.getPropertyOfType(returned, "__format");
  if (brand === undefined) return [];
  const type = checker.getTypeOfSymbolAtLocation(brand, call);
  return checker.getPropertiesOfType(type).map((p) => p.getName());
}

/** Whether `call` calls `@keel/schema`'s `formatLiteral`, however it is imported (name, alias or namespace member). */
function isFormatLiteral(call: ts.CallExpression, checker: ts.TypeChecker): boolean {
  const callee = call.expression;
  const at = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
  let sym = checker.getSymbolAtLocation(at);
  if (sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0) sym = checker.getAliasedSymbol(sym);
  return (sym?.declarations ?? []).some((d) => DECLARED_IN.test(d.getSourceFile().fileName.split("\\").join("/")));
}

/** The `@keel/std-*` package an identifier argument is imported from, when it is. */
function stdPackage(arg: ts.Expression, checker: ts.TypeChecker): string | undefined {
  const decl = ts.isIdentifier(arg) ? checker.getSymbolAtLocation(arg)?.declarations?.[0] : undefined;
  for (let n: ts.Node | undefined = decl; n !== undefined; n = n.parent)
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier))
      return n.moduleSpecifier.text.startsWith("@keel/std-") ? n.moduleSpecifier.text : undefined;
  return undefined;
}

/**
 * E1108 (k.formats): offsets and messages for each `formatLiteral` call whose `text` is no string literal (`'..'`, `".."`
 * or a template without substitution), whose `format` names no one registered format, or whose `text` the registered
 * format's `parse` refuses. Reported at the argument at fault. The registry is the process's: `keel check` imports the
 * `@keel/std-*` packages in `deps` first, and no app code runs.
 */
export function formatLiterals(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): { at: number; message: string; pkg?: string }[] {
  const out: { at: number; message: string; pkg?: string }[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && n.arguments.length >= 2 && isFormatLiteral(n, checker)) {
      const [format, text] = n.arguments;
      if (format !== undefined && text !== undefined) {
        const names = namesOf(n, checker);
        const name = names.length === 1 ? names[0] : undefined;
        const schema = name === undefined ? undefined : s.registry().get(name);
        if (schema === undefined)
          out.push({
            at: format.getStart(sf),
            message:
              names.length === 0
                ? "formatLiteral format is no format type over a string"
                : `formatLiteral format ${names.join(" & ")} is not one registered format`,
            ...(names.length === 0 || stdPackage(format, checker) === undefined
              ? {}
              : { pkg: stdPackage(format, checker) ?? "" }),
          });
        if (!ts.isStringLiteral(text) && !ts.isNoSubstitutionTemplateLiteral(text)) {
          out.push({ at: text.getStart(sf), message: "formatLiteral text is not a string literal" });
        } else if (schema !== undefined) {
          const r = schema.parse(text.text);
          if (!r.ok)
            out.push({
              at: text.getStart(sf),
              message: `formatLiteral text does not parse as ${name} (${r.error.data.issues[0]?.rule ?? "type"})`,
            });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
