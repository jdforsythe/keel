import ts from "typescript";

/** Date methods E1758 reports on a date receiver: local-time getters and local string conversions. */
const ON_DATE =
  /^(get(Hours|Minutes|Seconds|Milliseconds|Date|Day|Month|FullYear|Year|TimezoneOffset)|to(String|DateString|TimeString))$/;

const bare = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? bare(e.expression) : e);

/**
 * E1758 (k.host): offsets of the expressions whose TypeScript type is the library `Date`, among those the rule asks
 * about: the receiver of a local-time getter or string conversion (also the first argument of its `.call` form), the
 * argument of `String(...)`, and each value of an untagged template. `any` and `unknown` are not dates.
 */
export function dateReads(sf: ts.SourceFile, checker: ts.TypeChecker, program: ts.Program): number[] {
  const out: number[] = [];
  const isDate = (e: ts.Expression): boolean => {
    const t = checker.getNonNullableType(checker.getTypeAtLocation(e));
    if ((t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return false;
    const sym = t.getSymbol();
    return (
      sym?.getName() === "Date" &&
      (sym.declarations ?? []).some((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()))
    );
  };
  const ask = (e: ts.Expression | undefined): void => {
    if (e === undefined) return;
    const b = bare(e);
    if (isDate(b)) out.push(b.getStart(sf));
  };
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const c = bare(n.expression);
      if (ts.isIdentifier(c) && c.text === "String") ask(n.arguments[0]);
      else if (ts.isPropertyAccessExpression(c)) {
        const inner = bare(c.expression);
        if (ON_DATE.test(c.name.text)) ask(c.expression);
        else if (c.name.text === "call" && ts.isPropertyAccessExpression(inner) && ON_DATE.test(inner.name.text))
          ask(n.arguments[0]);
      }
    } else if (ts.isTemplateExpression(n) && !ts.isTaggedTemplateExpression(n.parent))
      for (const span of n.templateSpans) ask(span.expression);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
