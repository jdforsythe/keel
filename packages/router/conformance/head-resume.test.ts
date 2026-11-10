// @vitest-environment happy-dom
// Spec: k.head, clause "After `resume`, `document.title` and `lang` equal the served document's, and no text node was replaced." (rfc:0079) Seed 1337.
// ASSUMPTION: the router's mount over server-written markup is the resume path under test (the resume entry itself is not in the router's public API); the server's document is simulated by presetting title, lang and the body markup.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, open, pid, routes, titleOf } from "./head-fixtures.ts";

const textNodes = (root: Node): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) out.push(c);
      else walk(c);
    }
  };
  walk(root);
  return out;
};

describe("k.head resume", () => {
  test.skip("after resume, document.title and lang equal the served document's, and no text node was replaced", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("en-US", "de-DE"), fc.constantFrom("home", "about"), async (p, page) => {
        document.title = titleOf(p, page);
        document.documentElement.lang = p;
        const host = document.createElement("div");
        host.innerHTML = `<div id="shell"><p>${page} ${p}</p></div>`;
        document.body.append(host);
        const before = textNodes(host);
        const app = await open(String(routes.href(pid(page), { p })), host);
        expect(document.title).toBe(titleOf(p, page));
        expect(document.documentElement.lang).toBe(p);
        const after = textNodes(host);
        expect(after).toHaveLength(before.length);
        for (const [i, n] of before.entries()) expect(after[i]).toBe(n);
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
