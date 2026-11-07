// @vitest-environment happy-dom
// Property seed: 1337. k.compiler URL rule, enforced by attr/prop through src/url (the @keel/runtime-dom/url export).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { attr, clone, prop, template } from "../src/ops/index.ts";
import { safeUrl } from "../src/url/index.ts";
import { SEED, rootSignal } from "./support.ts";

const ALLOWED = ["http", "https", "mailto", "tel"];
const URL_ATTRS = ["href", "src", "action", "formaction", "poster", "ping", "HREF"];
const scheme = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9+.-]{0,10}$/);
const rest = fc.stringMatching(/^[a-z0-9/?#=&.-]{0,12}$/);

describe("safeUrl: only http, https, mailto, tel survive in URL attributes", () => {
  it("a disallowed scheme in a URL attribute becomes about:blank", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...URL_ATTRS),
        scheme.filter((s) => !ALLOWED.includes(s.toLowerCase())),
        rest,
        (name, sc, r) => {
          expect(safeUrl(name, `${sc}:${r}`)).toBe("about:blank");
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("an allowed scheme (any case) is kept verbatim", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...URL_ATTRS),
        fc.constantFrom(...ALLOWED, "HTTPS", "Mailto"),
        rest,
        (name, sc, r) => {
          expect(safeUrl(name, `${sc}:${r}`)).toBe(`${sc}:${r}`);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("relative, fragment, and query values have no scheme and are kept", () => {
    const relative = fc.oneof(
      rest.map((r) => `/${r}`),
      rest.map((r) => `./${r}:x`),
      rest.map((r) => `#${r}`),
      rest.map((r) => `?${r}`),
      fc.constant(""),
    );
    fc.assert(
      fc.property(fc.constantFrom(...URL_ATTRS), relative, (name, v) => {
        expect(safeUrl(name, v)).toBe(v);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("whitespace and control obfuscation of a scheme is still caught", () => {
    const junk = fc
      .array(fc.constantFrom(" ", "\t", "\n", "\r", "\u0000", "\u001f"), { maxLength: 4 })
      .map((a) => a.join(""));
    const split = fc.array(fc.constantFrom("", "\t", "\n", "\r"), { minLength: 10, maxLength: 10 });
    fc.assert(
      fc.property(junk, split, (lead, gaps) => {
        const word = [..."javascript"].map((c, i) => c + (gaps[i] ?? "")).join("");
        expect(safeUrl("href", `${lead}${word}:alert(1)`)).toBe("about:blank");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("non-URL attributes are never rewritten", () => {
    fc.assert(
      fc.property(fc.constantFrom("title", "class", "data-href", "alt"), scheme, rest, (name, sc, r) => {
        expect(safeUrl(name, `${sc}:${r}`)).toBe(`${sc}:${r}`);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("attr and prop apply the rule on every update", () => {
    const T = template('<a id="a">x</a>');
    fc.assert(
      fc.property(fc.array(fc.tuple(scheme, rest), { minLength: 1, maxLength: 5 }), (seq) => {
        const s = rootSignal("");
        const host = document.createElement("div");
        const dispose = mount(() => {
          const a = clone(T);
          attr(a, "href", () => s.get());
          prop(a, "title", () => s.get());
          return a;
        }, host);
        const a = host.querySelector("a");
        for (const [sc, r] of seq) {
          s.set(`${sc}:${r}`);
          const ok = ALLOWED.includes(sc.toLowerCase());
          expect(a?.getAttribute("href")).toBe(ok ? `${sc}:${r}` : "about:blank");
          expect(a?.getAttribute("title") ?? Reflect.get(a ?? {}, "title")).toBe(`${sc}:${r}`);
        }
        dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("ping is checked per space-separated URL; srcdoc (raw HTML) is always replaced", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...ALLOWED), rest), { minLength: 1, maxLength: 4 }),
        scheme.filter((s) => !ALLOWED.includes(s.toLowerCase())),
        fc.nat(4),
        fc.string(),
        (good, bad, at, html) => {
          const urls = good.map(([sc, r]) => `${sc}:${r}`);
          expect(safeUrl("ping", urls.join(" "))).toBe(urls.join(" "));
          const mixed = [...urls];
          mixed.splice(at % (urls.length + 1), 0, `${bad}:x`);
          expect(safeUrl("ping", mixed.join("  "))).toBe("about:blank");
          expect(safeUrl("srcdoc", html)).toBe("about:blank");
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
