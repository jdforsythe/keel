// @vitest-environment happy-dom
// Spec: k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: a `Link` with a `to` that is no `Href` renders `href="about:blank"`. The type half: ../unsafe/conformanceNegativeTypes.ts.
// Seed 1337 (fc.assert below).
import { contract } from "@keel/router/contract";
import { Link } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const c = contract("lk", { "lk.home": { path: "/" } });
const BAD = [
  "//evil.example/x",
  "/\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0085b",
  "/a\u0000b",
  "/a#frag",
  "",
];
const link = (to: unknown): Node => Reflect.apply(Link, undefined, [{ to, children: "x" }]);
const hrefOf = (node: Node): string | null => (node instanceof Element ? node.getAttribute("href") : null);

describe("rfc:0157 conformance: a Link whose to is no Href", () => {
  it('renders `href="about:blank"` for `//evil.example/x`, `/\\evil.example`, `https://evil.example/`, `javascript:alert(1)` and a control character', () => {
    for (const to of BAD) expect(hrefOf(link(to)), JSON.stringify(to)).toBe("about:blank");
  });

  it("a value that is not a string renders `about:blank`", () => {
    for (const to of [undefined, null, 1, {}]) expect(hrefOf(link(to))).toBe("about:blank");
  });

  it("a `c.href` link renders as given", () => {
    expect(hrefOf(link(c.href("lk.home")))).toBe("/");
  });

  it("for any generated `//`-led, `/\\`-led, scheme-led or control-character string, the rendered href is `about:blank`", () => {
    const tail = fc.stringMatching(/^[a-z0-9./]{0,8}$/);
    const bad = fc.oneof(
      tail.map((t) => `//${t}`),
      tail.map((t) => `/\\${t}`),
      tail.map((t) => `https://${t}`),
      tail.map((t) => `javascript:${t}`),
      tail.map((t) => `/${t}\u0085`),
    );
    fc.assert(
      fc.property(bad, (to) => {
        expect(hrefOf(link(to)), JSON.stringify(to)).toBe("about:blank");
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
