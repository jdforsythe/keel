// k.privacy-reads readers and W1114, over generated inputs: `carriesReveal` answers as E1112 does at a sink,
// `schemaHolds` finds a listed export at any depth and reads nothing else as one, `outputSchemas` lists one `output`
// per entry, and W1114 follows a generated path to its node. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { carriesReveal, check, defineRule, outputSchemas, schemaHolds } from "../src/index.ts";
import type { RuleInput, SourceFile } from "../src/index.ts";

const SEED = 1337;
const ident = fc
  .stringMatching(/^[a-z]{1,6}$/)
  .filter((s) => !["in", "do", "if", "for", "let", "new", "try", "var"].includes(s));

let hook: ((input: RuleInput) => unknown) | undefined;
let answer: unknown;
defineRule({
  code: "E2932",
  message: "privacy-reads property probe",
  see: "k.privacy-reads",
  explain: "Records what the privacy readers answer for a property test.",
  check: (input) => {
    if (hook !== undefined && input.file.path.endsWith("x.server.ts")) answer = hook(input);
    return [];
  },
});
const probe = (files: SourceFile[], h: (input: RuleInput) => unknown): unknown => {
  hook = h;
  answer = undefined;
  try {
    check(files, { types: false });
    return answer;
  } finally {
    hook = undefined;
  }
};
/** The first argument of the last `console.log(...)` statement of the file. */
const lastLogArg = (input: RuleInput) => {
  const fn = input.ast.body.at(-1);
  const body =
    fn?.type === "ExportNamedDeclaration" && fn.declaration?.type === "FunctionDeclaration"
      ? fn.declaration.body
      : null;
  const st = body?.body.at(-1);
  return st?.type === "ExpressionStatement" && st.expression.type === "CallExpression"
    ? st.expression.arguments[0]
    : undefined;
};

/** A carrier of k.reveal Flow around `x`, or a call that ends it. */
const wrap = fc.constantFrom(
  (x: string) => `{ a: ${x} }`,
  (x: string) => `[${x}]`,
  (x: string) => `\`p\${${x}}\``,
  (x: string) => `(c ? ${x} : 1)`,
  (x: string) => `String(${x})`,
  (x: string) => `${x}.trim()`,
  (x: string) => `hash(${x})`,
  (x: string) => `${x}.length`,
);

describe("carriesReveal", () => {
  test("answers as E1112 does for the same value at a console sink", () => {
    fc.assert(
      fc.property(fc.array(wrap, { maxLength: 4 }), (ws) => {
        const expr = ws.reduce((x, w) => w(x), "reveal(p.k)");
        const source = `import { reveal } from "@keel/schema"\nimport { hash } from "./hash.ts"\nexport function f(p, c) {\n  console.log(${expr})\n}\n`;
        const files = [{ path: "modules/a/x.server.ts", source }];
        const got = probe(files, (input) => {
          const arg = lastLogArg(input);
          return arg === undefined ? "none" : carriesReveal(arg, input);
        });
        const e1112 = check(files, { types: false }).diagnostics.some((d) => d.code === "E1112");
        expect(got).toBe(e1112);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});

describe("schemaHolds", () => {
  const NAMES = [{ from: "@keel/std-tokens", name: "Digested" }];
  const nest = (depth: number, leaf: string, keys: string[]): string =>
    Array.from({ length: depth }).reduce<string>(
      (x, _, i) => `s.object({ ${keys[i % keys.length] ?? "k"}: ${x} })`,
      leaf,
    );
  test("is 'yes' for the listed export at any depth, through a schema file, and 'no' for a plain leaf", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(ident, { minLength: 1, maxLength: 5 }),
        fc.boolean(),
        (depth, keys, viaFile) => {
          for (const [leaf, want] of [
            ["Digested", "yes"],
            ["s.string().optional()", "no"],
            ["make()", "unknown"],
          ] as const) {
            const schema = nest(depth, leaf, keys);
            const head = `import { s } from "@keel/schema"\nimport { Digested } from "@keel/std-tokens"\n`;
            const files = viaFile
              ? [
                  { path: "modules/a/row.schema.ts", source: `${head}export const Row = ${schema}\n` },
                  {
                    path: "modules/a/x.server.ts",
                    source: `import { Row } from "./row.schema.ts"\nexport const v = Row\n`,
                  },
                ]
              : [{ path: "modules/a/x.server.ts", source: `${head}export const v = ${schema}\n` }];
            const got = probe(files, (input) => {
              const st = input.ast.body.at(-1);
              const init =
                st?.type === "ExportNamedDeclaration" && st.declaration?.type === "VariableDeclaration"
                  ? st.declaration.declarations[0]?.init
                  : null;
              return init === null || init === undefined ? "none" : schemaHolds(init, input, NAMES);
            });
            expect(got).toBe(want);
          }
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("outputSchemas", () => {
  test("lists one output per API entry that has one, in source order, at its line", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }), (withOutput) => {
        const entries = withOutput.map(
          (o, i) => `  "a.e${i}": { method: "GET", path: "/e${i}"${o ? ", output: s.json()" : ""} },`,
        );
        const source = `import { contract } from "@keel/router/contract"\nimport { s } from "@keel/schema"\nexport const a = contract("a", {\n${entries.join("\n")}\n})\n`;
        const got = probe([{ path: "modules/a/x.server.ts", source }], (input) =>
          outputSchemas(input).map((o) => o.line),
        );
        const want = withOutput.flatMap((o, i) => (o ? [4 + i] : []));
        expect(got).toEqual(want);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("W1114", () => {
  test("follows a generated path to its node: one warning for a plain string, none for s.secret", () => {
    fc.assert(
      fc.property(fc.array(ident, { minLength: 1, maxLength: 4 }), fc.boolean(), (keys, secret) => {
        const leaf = secret ? "s.secret(s.string()).optional()" : "s.string().pii('contact')";
        const schema = keys.reduceRight<string>((x, k) => `s.object({ ${k}: ${x} })`, leaf);
        const source = `import { Input } from "@keel/ui"\nimport { form } from "@keel/forms"\nimport { s } from "@keel/schema"\nconst f = form(${schema}, {})\nexport default function V() { return <Input type="password" field={f.field("${keys.join(".")}")} label="P" /> }\n`;
        const ds = check([{ path: "modules/a/V.tsx", source }], { types: false }).diagnostics.filter(
          (d) => d.code === "W1114",
        );
        expect(ds.map((d) => d.line)).toEqual(secret ? [] : [5]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
