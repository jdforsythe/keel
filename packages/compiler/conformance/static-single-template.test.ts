// Seed 1337 (fc.assert seed below).
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";

const count = (code: string, re: RegExp) => (code.match(re) ?? []).length;

test("A component with no dynamic expressions compiles to a single cloned template and no bindings", () => {
  const tag = fc.constantFrom("div", "section", "p", "span", "ul");
  const word = fc.stringMatching(/^[a-z]{1,8}$/);
  fc.assert(
    fc.property(fc.array(fc.tuple(tag, word), { minLength: 1, maxLength: 6 }), (kids) => {
      const body = kids.map(([t, w]) => `<${t} class="${w}">${w}</${t}>`).join("");
      const r = compile([{ path: "S.tsx", source: `export default function S() { return <main>${body}</main> }` }]);
      expect(r.diagnostics).toEqual([]);
      const code = r.outputs[0]?.code ?? "";
      expect(count(code, /\btemplate\(/g)).toBe(1);
      expect(count(code, /\bclone\(/g)).toBe(1);
      expect(count(code, /\btext\(/g)).toBe(0);
      expect(count(code, /\battr\(/g)).toBe(0);
      expect(count(code, /\bprop\(/g)).toBe(0);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
