import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { isNegativeTypeTest } from "../internal/isNegativeTypeTest.ts";
import { isTypeTestName } from "../internal/isTypeTestName.ts";
import { specifierLiterals } from "../internal/specifierLiterals.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const WHAT: Readonly<Record<string, string>> = {
  home: "negative type test outside a test/ or conformance/ folder; move it there",
  import: "import of a negative type test; it is type-checked, never run or imported",
  unsafe: "unsafe() call in a negative type test; an expectation needs none",
};

/** A specifier naming a `*.test-d.ts(x)` file, with or without its extension. */
const TYPE_TEST_SPEC = /\.test-d(?:\.[cm]?[jt]sx?)?$/;

/**
 * E1761 (k.unsafe): a `*.test-d.ts(x)` file not under a `test/` or `conformance/` folder (at line 1); an `import`,
 * `export ... from` or `import()` naming one (at the specifier); an `unsafe(` call in one (at the call).
 */
export const negativeTypeTestHome: RuleDef = {
  code: "E1761",
  message: (f) => WHAT[str(f.data, "kind")] ?? WHAT.home ?? "",
  see: "k.unsafe",
  check: ({ file, ast }) => {
    if (!isCodePath(file.path)) return [];
    const out: Finding[] = [];
    if (isTypeTestName(file.path) && !isNegativeTypeTest(file.path)) out.push(findingAt(file, 0, { kind: "home" }));
    for (const s of specifierLiterals(ast))
      if (TYPE_TEST_SPEC.test(s.spec)) out.push(findingAt(file, s.start, { kind: "import" }));
    if (isTypeTestName(file.path))
      new Visitor({
        CallExpression: (n) => {
          if (n.callee.type === "Identifier" && n.callee.name === "unsafe")
            out.push(findingAt(file, n.start, { kind: "unsafe" }));
        },
      }).visit(ast);
    return out.sort((a, b) => a.line - b.line || a.col - b.col);
  },
};
