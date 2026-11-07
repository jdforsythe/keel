// Spec: k.compiler, clause "Any `srcdoc`, and a `vbscript:` URL in any URL attribute, is E1003 as a literal and `about:blank` when bound."
// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { codes, isMountable, load, sigOf } from "./support.ts";

const hosts: readonly (readonly [string, string])[] = [
  ["href", "a"],
  ["src", "img"],
  ["action", "form"],
  ["formaction", "button"],
  ["xlink:href", "a"],
  ["poster", "video"],
  ["ping", "a"],
];

function loadIgnoringDiagnostics(src: string) {
  const first = compile([{ path: "B.tsx", source: src }]).outputs[0];
  if (first === undefined) throw new Error("no output");
  const c = evaluate(first.code);
  if (!isMountable(c)) throw new Error("default export is not a component");
  return c;
}

function render(tag: string, attr: string, value: string): string | null {
  const src = `
import { signal } from '@keel/reactive'
const u = signal('')
function B() {
  return <${tag} ${attr}={u.get()} />
}
B.u = u
export default B
`;
  // A bound srcdoc is itself reported E1003 by the compiler; the runtime op is tested on the emitted code regardless.
  const B = attr === "srcdoc" ? loadIgnoringDiagnostics(src) : load("B", src);
  sigOf(B, "u").set(value);
  const host = document.createElement("div");
  const dispose = mount(B, host);
  const out = host.querySelector(tag)?.getAttribute(attr) ?? null;
  dispose();
  return out;
}

test("Any `srcdoc` literal is E1003", () => {
  fc.assert(
    fc.property(fc.constantFrom("<p>hi</p>", "x", ""), (v) => {
      const d = codes(`export default function C() { return <iframe srcdoc="${v}" /> }`);
      expect(d.map((x) => x.code)).toContain("E1003");
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("A bound `srcdoc` renders as `about:blank`", () => {
  fc.assert(
    fc.property(fc.constantFrom("<p>hi</p>", "x", "https://example.com"), (v) => {
      expect(render("iframe", "srcdoc", v)).toBe("about:blank");
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("A `vbscript:` URL literal in any URL attribute is E1003", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...hosts),
      fc.constantFrom("vbscript:msgbox(1)", "VBScript:msgbox(1)"),
      ([attr, tag], v) => {
        const d = codes(`export default function C() { return <${tag} ${attr}="${v}" /> }`);
        expect(d.map((x) => x.code)).toContain("E1003");
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("A `vbscript:` URL bound to href or src renders as `about:blank`", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(["href", "a"], ["src", "img"]),
      fc.constantFrom("vbscript:msgbox(1)", "VBScript:msgbox(1)"),
      ([attr, tag], v) => {
        expect(render(tag ?? "a", attr ?? "href", v)).toBe("about:blank");
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});

test("A literal https URL in a URL attribute emits no E1003 (clean counterpart)", () => {
  const d = codes(`export default function C() { return <img src="https://example.com/a.png" /> }`);
  expect(d.map((x) => x.code)).not.toContain("E1003");
});
