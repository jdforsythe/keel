// @vitest-environment happy-dom
// k.claim In place and Server: `frag` builds a fragment outside a claim and moves no claimed node while resuming;
// `made` records an element placed by an op that started after it was made. Seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { made } from "../src/internal/made.ts";
import { clone, element, frag, parts, resume, slot, template } from "../src/ops/index.ts";

const B = template("<b>x</b>");
const ROOT = template('<div id="r" data-k="r"><!----></div>');

describe("frag", () => {
  it("outside a claim, returns a fragment holding its items in order, text included (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constant("el"), fc.string({ maxLength: 4 })), { maxLength: 6 }), (items) => {
        const f = frag((s) => {
          for (const it of items) s.append(it === "el" ? clone(B) : it);
        });
        expect(f.nodeType).toBe(11);
        expect(parts(f)).toBeUndefined();
        expect(f.textContent).toBe(items.map((it) => (it === "el" ? "x" : it)).join(""));
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("while resuming, an island's two elements and text stay where the server put them", () => {
    document.body.innerHTML =
      '<div id="r" data-k="r" data-k-island="i"><!--[-->lead <b>x</b> tail <b>x</b><!--]--><!----></div>';
    const served = [...document.querySelectorAll("b")];
    const seen: Node[] = [];
    const observer = new MutationObserver((rs) => {
      for (const r of rs) seen.push(...r.removedNodes);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    let got: readonly Node[] | undefined;
    const Island = (): Node => {
      const r = clone(ROOT);
      const at = r.childNodes[0];
      if (at === undefined) throw new Error("fixture");
      slot(at, () => {
        const out = frag((s) => {
          s.append("lead ");
          s.append(clone(B));
          s.append(" tail ");
          s.append(clone(B));
        });
        got = parts(out);
        return out;
      });
      return r;
    };
    const { warnings } = resume(document.body, { i: Island });
    seen.push(...observer.takeRecords().flatMap((r) => [...r.removedNodes]));
    observer.disconnect();
    expect(warnings).toEqual([]);
    expect(seen.filter((n) => n.nodeType === 1)).toEqual([]);
    expect([...document.querySelectorAll("b")]).toEqual(served);
    expect(got?.filter((n) => n.nodeType === 1)).toEqual(served);
  });
});

describe("made", () => {
  it("an element fill placing an element made before it sets eager; one made inside does not", () => {
    made.on = true;
    made.from = made.seq;
    made.eager = false;
    try {
      element("div", (el) => el.append(element("span", () => undefined)));
      expect(made.eager).toBe(false);
      const early = element("span", () => undefined);
      element("div", (el) => el.append(early));
      expect(made.eager).toBe(true);
    } finally {
      made.on = false;
    }
  });
});
