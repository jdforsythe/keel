// Spec: k.privacy-reads, Conformance "<Input type="password" field={f.field('pw')} label="P" /> with pw: s.string() is one W1114, as are autocomplete="new-password" without type, the schema imported from a *.schema.ts, and a nested path a.pw; pw: s.secret(s.string()).optional(), f.field(p), pw: make() and type={t} are none."
// Each case of the clause over generated field names, inside a component body as an app writes it. Seed 1337.
import fc from "fast-check";
import { expect, test } from "vitest";
import { check } from "../src/index.ts";

const SEED = 1337;
const RUNS = 100;
const key = fc
  .stringMatching(/^[a-z]{1,8}$/)
  .filter((k) => !["do", "if", "in", "for", "let", "new", "try", "var"].includes(k));

/** W1114 lines of a `Login.tsx` holding `const f = form(<schema>, {})` and the control `attrs` in its body. */
function lines(schema: string, attrs: string, schemaFile?: string): number[] {
  const source = `import { Input } from "@keel/ui"\nimport { form } from "@keel/forms"\nimport { s } from "@keel/schema"\nimport { Pw } from "./pw.schema.ts"\nexport default function Login(p: string, t: string) {\n  const f = form(${schema}, {})\n  return <Input ${attrs} label="P" />\n}\n`;
  const files = [{ path: "modules/a/Login.tsx", source }];
  if (schemaFile !== undefined) files.push({ path: "modules/a/pw.schema.ts", source: schemaFile });
  return check(files, { types: false })
    .diagnostics.filter((d) => d.code === "W1114")
    .map((d) => d.line);
}

test("each reporting case of the clause is one W1114 at the control", () => {
  fc.assert(
    fc.property(key, key, (k, outer) => {
      const plain = `s.object({ ${k}: s.string() })`;
      expect(lines(plain, `type="password" field={f.field('${k}')}`)).toEqual([7]);
      expect(lines(plain, `autocomplete="new-password" field={f.field('${k}')}`)).toEqual([7]);
      const file = `import { s } from "@keel/schema"\nexport const Pw = s.object({ ${k}: s.string() })\n`;
      expect(lines("Pw", `type="password" field={f.field('${k}')}`, file)).toEqual([7]);
      expect(lines(`s.object({ ${outer}: ${plain} })`, `type="password" field={f.field('${outer}.${k}')}`)).toEqual([
        7,
      ]);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

test("each quiet case of the clause is no W1114", () => {
  fc.assert(
    fc.property(key, (k) => {
      const plain = `s.object({ ${k}: s.string() })`;
      expect(
        lines(`s.object({ ${k}: s.secret(s.string()).optional() })`, `type="password" field={f.field('${k}')}`),
      ).toEqual([]);
      expect(lines(plain, `type="password" field={f.field(p)}`)).toEqual([]);
      expect(lines(`s.object({ ${k}: make() })`, `type="password" field={f.field('${k}')}`)).toEqual([]);
      expect(lines(plain, `type={t} field={f.field('${k}')}`)).toEqual([]);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
