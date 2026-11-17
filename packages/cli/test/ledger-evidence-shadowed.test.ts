// Ledger evidence and shadowing (k.ledger): a call whose callee, or namespace base, a local binding shadows earns no
// rung; the same call on the import earns it.
import { describe, expect, it } from "vitest";
import { testEvidence } from "../src/internal/testEvidence.ts";
import { testFacts } from "../src/internal/testFacts.ts";

const T = "packages/a/test/t.test.ts";
const kinds = (source: string) => testEvidence([{ path: T, source }], new Set(), "5.3.3").map((r) => r.ev.kind);

interface Case {
  name: string;
  imports: string;
  call: string;
  rung: string;
  /** Declares `local`, the callee identifier, by a form. */
  forms: Record<string, (local: string, body: string) => string>;
}

const forms = {
  const: (l: string, body: string) => `it("x", async () => { const ${l} = (..._a: unknown[]) => _a; ${body} });`,
  param: (l: string, body: string) => `it("x", async () => { await ((${l}: unknown) => { ${body} })(0); });`,
  destructured: (l: string, body: string) => `it("x", async () => { const { ${l} } = mine(); ${body} });`,
};

const cases: Case[] = [
  {
    name: "properties",
    imports: 'import { properties } from "@keel/testing";\n',
    call: "properties(app, {});",
    rung: "property",
    forms,
  },
  {
    name: "simulate",
    imports: 'import { simulate } from "@keel/testing";\n',
    call: "simulate(app, {});",
    rung: "property",
    forms,
  },
  {
    name: "explore",
    imports: 'import { explore } from "@keel/testing";\n',
    call: "explore(app, {});",
    rung: "proven",
    forms,
  },
  {
    name: "prove",
    imports: 'import { prove } from "@keel/testing/prove";\n',
    call: "await prove(app);",
    rung: "proven",
    forms,
  },
  {
    name: "expectTypeOf",
    imports: 'import { expectTypeOf } from "vitest";\n',
    call: "expectTypeOf(1);",
    rung: "proven",
    forms,
  },
  {
    name: "assertType",
    imports: 'import { assertType } from "vitest";\n',
    call: "assertType(1);",
    rung: "proven",
    forms,
  },
  {
    name: "fc",
    imports: 'import fc from "fast-check";\n',
    call: "fc.assert(fc.property(fc.nat(), () => true));",
    rung: "property",
    forms,
  },
];

describe("testEvidence: shadowed evidence calls", () => {
  for (const c of cases) {
    const local = c.name;
    it(`${c.name}: the unshadowed call earns ${c.rung}`, () => {
      const got = kinds(`${c.imports}it("x", async () => { ${c.call} });`);
      expect(got).toEqual([c.rung]);
    });
    for (const [form, make] of Object.entries(c.forms)) {
      it(`${c.name}: shadowed by a ${form} earns only an example`, () => {
        expect(kinds(`${c.imports}${make(local, c.call)}`)).toEqual(["example"]);
      });
    }
  }
});

describe("testEvidence: shadowing by class, enum and namespace names", () => {
  const KT = 'import { explore } from "@keel/testing";\n';
  it("a named class expression, an enum and a namespace of the callee's name hide the import", () => {
    expect(kinds(`${KT}it("x", () => { const C = class explore { m() { explore(a); } }; });`)).toEqual(["example"]);
    expect(kinds(`${KT}it("x", () => { enum explore { A } explore; });`)).toEqual(["example"]);
    expect(kinds(`${KT}it("x", () => { namespace explore { export const a = 1; } explore.a; });`)).toEqual(["example"]);
  });
});

describe("testEvidence: a shadowed namespace base", () => {
  const NS = 'import * as local from "@keel/testing";\n';
  it("the unshadowed namespace call keeps its rung", () => {
    expect(kinds(`${NS}it("x", () => { local.explore(app, {}); });`)).toEqual(["proven"]);
  });
  it("a local of the namespace's name earns only an example", () => {
    expect(kinds(`${NS}it("x", () => { const local = mine(); local.explore(app, {}); });`)).toEqual(["example"]);
    expect(kinds(`${NS}it("x", () => { ((local: unknown) => { local.explore(app, {}); })(0); });`)).toEqual([
      "example",
    ]);
  });
  it("a member read off a local of the namespace's name adds no referenced name", () => {
    const names = (src: string) => testFacts(T, src).tests.flatMap((t) => [...t.names]);
    expect(names(`${NS}it("x", () => { use(local.value); });`)).toContain("value");
    expect(names(`${NS}it("x", () => { const local = mine(); use(local.value); });`)).not.toContain("value");
  });
});
