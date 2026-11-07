// Seed 1337
// Spec: k.compiler Rules E1000 and Conformance "A file with a syntax error yields only E1000, also in routes.ts at build time."
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";

const BROKEN = [
  "export default function C() { return <div> }",
  "export default function C( { return null }",
  "export default function C() { return <div></span> }",
  "const = 1;",
];
// Things that would otherwise be E1002 / E1501 in a parseable file.
const EXTRA = [
  "",
  `const a = <a href="/x">x</a>;`,
  `const b = <div innerHTML="x" />;`,
  `const c = <a href="/x">x</a>; const d = <div innerHTML="y" />;`,
];

test("E1000: a file with a syntax error yields only E1000 diagnostics, even when it also holds E1002 or E1501 material", () => {
  fc.assert(
    fc.property(fc.constantFrom(...BROKEN), fc.constantFrom(...EXTRA), (broken, extra) => {
      const r = compile([{ path: "C.tsx", source: `${extra}\n${broken}\n` }]);
      expect(r.diagnostics.length).toBeGreaterThan(0);
      expect([...new Set(r.diagnostics.map((d) => d.code))]).toEqual(["E1000"]);
    }),
    { seed: 1337, numRuns: 40 },
  );
});

test("E1000: reported at the parser's location, line 3 for an error on line 3", () => {
  const r = compile([{ path: "C.tsx", source: "const ok = 1;\nconst fine = 2;\nconst = 3;\n" }]);
  const d = r.diagnostics[0];
  expect(d?.code).toBe("E1000");
  expect(d?.path).toBe("C.tsx");
  expect(d?.line).toBe(3);
  expect(d?.col).toBeGreaterThanOrEqual(1);
});

test("E1000: the message is `syntax error: <parser message>` under 90 chars", () => {
  fc.assert(
    fc.property(fc.constantFrom(...BROKEN), fc.constantFrom(...EXTRA), (broken, extra) => {
      const r = compile([{ path: "C.tsx", source: `${extra}\n${broken}\n` }]);
      for (const d of r.diagnostics) {
        expect(d.message.startsWith("syntax error: ")).toBe(true);
        expect(d.message.length).toBeLessThan(90);
      }
    }),
    { seed: 1337, numRuns: 40 },
  );
});

test("E1000: the file gets no other rule, element or lowering: ids.json and a11y.json have no entries from it", () => {
  const good = { path: "Good.tsx", source: `export default function G() { return <p id="good">x</p> }` };
  const bad = {
    path: "Bad.tsx",
    source: `export default function B() { return <div><button id="bad">x</button><a href="/x">y</a> }`,
  };
  const r = compile([good, bad]);
  expect(r.diagnostics.map((d) => d.code)).toEqual(["E1000"]);
  expect(r.diagnostics.every((d) => d.path === "Bad.tsx")).toBe(true);
  const ids = r.artifacts["ids.json"];
  expect(Object.keys(ids)).toContain("good");
  expect(Object.keys(ids)).not.toContain("bad");
  expect(Object.values(ids).every((e) => e.file !== "Bad.tsx")).toBe(true);
  expect(Object.keys(r.artifacts["a11y.json"])).not.toContain("bad");
  expect(r.outputs.some((o) => o.path === "Bad.tsx")).toBe(false);
});
