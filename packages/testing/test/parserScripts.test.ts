// k.e2e-page `hold`: the scripts a held document's parser waits for, which run as it reaches them.
// Seed 1337 for the property.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parserScripts } from "../src/internal/e2e/parserScripts.ts";

const BASE = "http://127.0.0.1:4000/about/";

describe("parserScripts", () => {
  it("names a classic external script with neither async nor defer, resolved against the document", () => {
    const html =
      '<head><script src="/assets/keel-scheme-ab12.js"></script><script src=\'rel.js\' type="text/javascript"></script></head>';
    expect([...parserScripts(html, BASE)]).toEqual([
      "http://127.0.0.1:4000/assets/keel-scheme-ab12.js",
      "http://127.0.0.1:4000/about/rel.js",
    ]);
  });

  it("leaves out module, async, deferred, data and inline scripts", () => {
    const html = [
      '<script type="module" src="/assets/entry.js"></script>',
      '<script async src="/a.js"></script>',
      "<script defer src=/d.js></script>",
      '<script type="application/json" id="k-state">{}</script>',
      "<script>1</script>",
      '<script data-defer="1" src="/kept.js"></script>',
    ].join("");
    expect([...parserScripts(html, BASE)]).toEqual(["http://127.0.0.1:4000/kept.js"]);
  });

  it("a script element's attributes decide it, whatever else the document holds", () => {
    const typed = fc.constantFrom("", " async", " defer", ' type="module"', ' type="text/javascript"', " crossorigin");
    // One `type` per element: of two, a browser reads the first.
    const untyped = fc.constantFrom("", " async", " defer", " crossorigin");
    fc.assert(
      fc.property(fc.array(fc.tuple(typed, untyped), { maxLength: 6 }), (tags) => {
        const html = tags.map(([a, b], i) => `<p>${i}</p><script${a} src="/s${i}.js"${b}></script>`).join("");
        const expected = tags.flatMap(([a, b], i) =>
          /async|defer|module/.test(a + b) ? [] : [`http://127.0.0.1:4000/s${i}.js`],
        );
        expect([...parserScripts(html, BASE)]).toEqual(expected);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
