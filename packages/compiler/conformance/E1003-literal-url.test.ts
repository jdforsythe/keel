import fc from "fast-check";
import { expect, test } from "vitest";
import { codes } from "./support.ts";

// Seed 1337
test("E1003: a literal javascript: or data: URL in a URL attribute produces a diagnostic", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("href", "src", "action", "formaction"),
      fc.constantFrom("javascript:alert(1)", "data:text/html,x", "javascript:void(0)"),
      (attr, url) => {
        const d = codes(`export default function C() { return <a ${attr}="${url}">x</a> }`);
        expect(d.map((x) => x.code)).toContain("E1003");
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("E1003: a literal https: URL emits no E1003", () => {
  expect(
    codes(`export default function C() { return <a href="https://example.com">x</a> }`).map((x) => x.code),
  ).not.toContain("E1003");
});
