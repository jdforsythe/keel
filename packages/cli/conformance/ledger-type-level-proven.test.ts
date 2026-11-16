// Spec: k.ledger, clause "A passing test whose body asserts with `expectTypeOf` makes the exports it names `proven`."
// Spec: k.ledger, Ledger "`proven`: a passing type-level test (its body calls `expectTypeOf` or `assertType`, type-checked by the package's `check`), a passing closed-form `explore` (k.model), passing only when the store's whole space closed, or a passing `prove` its body awaits or returns (k.prove; evidence: Z3 version); nothing else claims it."
// The real `keel` binary over a temp project (OS tmpdir). Seed: 1337 (no property in this file).
import { describe, expect, it } from "vitest";
import { EXAMPLE, ITEM, SOURCE, exampleTest, source } from "./ledger-fixture.ts";
import { ledgerRecord, withProject } from "./ledger-fixture-kinds.ts";
import { keel } from "./test-sim-project.ts";

const TYPE_TEST = "packages/m/test/clamp-types.test.ts";

const typeTest = (body: string): string => `import { assertType, expectTypeOf, it } from "vitest";
import { clamp } from "../src/clamp.ts";

it("clamp has the declared type", () => {
  ${body}
});
`;

const rungOf = (test: string, extra: Record<string, string> = {}) =>
  withProject(
    "ledger-type-level",
    { [SOURCE]: source, [TYPE_TEST]: test, ...extra },
    (dir) => ledgerRecord(keel(dir, ["ledger"]), ITEM)?.rung,
  );

describe("k.ledger: type-level evidence", () => {
  it("A passing test whose body asserts with `expectTypeOf` makes the exports it names `proven`.", () => {
    expect(rungOf(typeTest("expectTypeOf(clamp).returns.toBeNumber();"))).toBe("proven");
  }, 60_000);

  it("a passing test whose body asserts with `assertType` makes the exports it names `proven`", () => {
    expect(rungOf(typeTest("assertType<number>(clamp(1, 0, 2));"))).toBe("proven");
  }, 60_000);

  it("a passing test that names the export without asserting its type does not claim `proven`", () => {
    const noAssertion = typeTest("void clamp(1, 0, 2);");
    expect(rungOf(noAssertion, { [EXAMPLE]: exampleTest })).toBe("example");
  }, 60_000);
});
