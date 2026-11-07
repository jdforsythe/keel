// Seed 1337
// Spec: k.component, clause "A plain `.ts` component file exporting `Props` and `uses` beside its default export reports neither E1752 nor E1104."
// Spec: k.component, clause "A PascalCase `.ts` file whose default export is not a function taking `Props` and that exports a `Props` schema reports E1104."
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const pascal = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const codes = (src: string, path: string) =>
  check([{ path, source: src }], { types: false }).diagnostics.map((d) => d.code);

const IMP = `import { s } from "@keel/schema";\nimport type { Infer } from "@keel/schema";\n`;
const HEAD = `${IMP}export const Props = s.object({});\n`;
const USES = `export const uses = [];\n`;
const typed = (n: string) => `export default function ${n}(props: Infer<typeof Props>) { return null; }\n`;
const forms: Record<string, (n: string) => string> = {
  declaration: (n) => `${HEAD}${USES}${typed(n)}`,
  "const then default": (n) =>
    `${HEAD}${USES}const ${n} = (props: Infer<typeof Props>) => null;\nexport default ${n};\n`,
  "anonymous arrow with local Props type": () =>
    `${IMP}export const Props = s.object({});\ntype Props = Infer<typeof Props>;\n${USES}export default (props: Props) => null;\n`,
};

const clause1 =
  "A plain `.ts` component file exporting `Props` and `uses` beside its default export reports neither E1752 nor E1104.";
for (const [label, make] of Object.entries(forms)) {
  test(`${clause1} (${label})`, () => {
    fc.assert(
      fc.property(pascal, (name) => {
        const got = codes(make(name), `modules/x/${name}.ts`);
        expect(got).not.toContain("E1752");
        expect(got).not.toContain("E1104");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
}

test("A plain `.ts` component file exporting only `Props` beside its default export reports neither E1752 nor E1104.", () => {
  fc.assert(
    fc.property(pascal, (name) => {
      const got = codes(`${HEAD}${typed(name)}`, `modules/x/${name}.ts`);
      expect(got).not.toContain("E1752");
      expect(got).not.toContain("E1104");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

const clause2 =
  "A PascalCase `.ts` file whose default export is not a function taking `Props` and that exports a `Props` schema reports E1104.";
const PHEAD = `import { s } from "@keel/schema";\nexport const Props = s.object({});\n`;

test(`${clause2} (object default)`, () => {
  fc.assert(
    fc.property(pascal, (name) => {
      const src = `import { s } from "@keel/schema"; export default { a: 1 }; export const Props = s.object({ a: s.string() });\n`;
      expect(codes(src, `modules/app/${name}.ts`)).toContain("E1104");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test(`${clause2} (untyped first parameter)`, () => {
  fc.assert(
    fc.property(pascal, (name) => {
      const src = `${PHEAD}export default function ${name}(props) { return null; }\n`;
      expect(codes(src, `modules/app/${name}.ts`)).toContain("E1104");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test(`${clause2} (first parameter not typed from Props)`, () => {
  fc.assert(
    fc.property(pascal, (name) => {
      const src = `${PHEAD}export default function ${name}(props: string) { return null; }\n`;
      expect(codes(src, `modules/app/${name}.ts`)).toContain("E1104");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test(`${clause2} (lowercase .tsx with default export)`, () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-zA-Z]{2,8}$/), (name) => {
      const src = `${PHEAD}export default function ${name}() { return null; }\n`;
      expect(codes(src, `modules/app/${name}.tsx`)).toContain("E1104");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("control: a camelCase `.ts` file with a default export and `Props` still reports E1104.", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-zA-Z]{2,8}$/), (name) => {
      expect(codes(`${HEAD}${typed(name)}`, `modules/x/${name}.ts`)).toContain("E1104");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("control: a PascalCase `.ts` file exporting `Props` and a third named export still reports E1752.", () => {
  fc.assert(
    fc.property(pascal, (name) => {
      fc.pre(name !== "Other");
      const got = codes(`${HEAD}export const Other = 1;\n${typed(name)}`, `modules/x/${name}.ts`);
      expect(got).toContain("E1752");
    }),
    { seed: SEED, numRuns: 20 },
  );
});
