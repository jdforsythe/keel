// @vitest-environment happy-dom
// Property seed: 1337. A tree of structural ops and slots rendered in the runtime's server mode writes regions that
// `resume` claims: no warning, every server element kept, and each op still updates in place. Anchors are read by
// `childNodes[i]`, as compiled output reads them, between elements, so regions before an anchor are skipped.
import { signal } from "@keel/reactive";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { serverMode } from "../src/internal/serverMode.ts";
import { mount } from "../src/mount.ts";
import { boundary, clone, cond, list, match, resume, slot, template } from "../src/ops/index.ts";
import { SEED } from "./support.ts";

type Op =
  | { readonly k: "if"; readonly on: boolean; readonly kids: readonly Op[] }
  | { readonly k: "for"; readonly rows: number; readonly empty: boolean; readonly kids: readonly Op[] }
  | { readonly k: "match"; readonly tag: "a" | "b"; readonly kids: readonly Op[] }
  | { readonly k: "boundary"; readonly kids: readonly Op[] }
  | { readonly k: "slot"; readonly filled: boolean };

const ops: fc.Arbitrary<Op> = fc.letrec<{ op: Op }>((tie) => {
  const kids = fc.array(tie("op"), { maxLength: 2 });
  return {
    op: fc.oneof(
      { depthSize: "small", withCrossShrink: true },
      fc.record({ k: fc.constant("slot" as const), filled: fc.boolean() }),
      fc.record({ k: fc.constant("if" as const), on: fc.boolean(), kids }),
      fc.record({ k: fc.constant("for" as const), rows: fc.integer({ min: 0, max: 3 }), empty: fc.boolean(), kids }),
      fc.record({ k: fc.constant("match" as const), tag: fc.constantFrom("a" as const, "b" as const), kids }),
      fc.record({ k: fc.constant("boundary" as const), kids }),
    ),
  };
}).op;

const KEYS = ["a", "b", "c"];
const I = template("<i>t</i>");
const P = template("<p>none</p>");
const templates = new Map<number, HTMLTemplateElement>();
/** `<div><b></b><!----><b></b><!---->…</div>`: an element before each anchor, so a region shifts every later index. */
const box = (n: number): HTMLTemplateElement => {
  const t = templates.get(n) ?? template(`<div>${"<b></b><!---->".repeat(n)}</div>`);
  templates.set(n, t);
  return t;
};

/** Renders `kids` in a fresh `<div>`; every toggle the tree has is pushed to `flips`. */
function render(kids: readonly Op[], flips: (() => void)[]): Element {
  const el = clone(box(kids.length));
  const anchors = kids.map((_, i) => {
    const a = el.childNodes[2 * i + 1];
    if (a === undefined) throw new Error("fixture: no anchor");
    return a;
  });
  kids.forEach((op, i) => {
    const a = anchors[i];
    if (a === undefined) return;
    switch (op.k) {
      case "slot":
        slot(a, () => (op.filled ? clone(I) : ""));
        return;
      case "if": {
        const on = signal(op.on);
        flips.push(() => on.set(!on.get()));
        cond(
          a,
          () => on.get(),
          () => render(op.kids, []),
        );
        return;
      }
      case "for": {
        const rows = signal(KEYS.slice(0, op.rows));
        flips.push(() => rows.set(rows.get().length === 3 ? [] : [...rows.get(), "z"].slice(-3)));
        list(
          a,
          () => rows.get(),
          (k) => k,
          () => render(op.kids, []),
          op.empty ? () => clone(P) : undefined,
        );
        return;
      }
      case "match": {
        const tag = signal({ tag: op.tag });
        flips.push(() => tag.set({ tag: tag.get().tag === "a" ? "b" : "a" }));
        const branch = () => render(op.kids, []);
        match(a, () => tag.get(), "tag", { a: branch, b: branch });
        return;
      }
      case "boundary":
        boundary(
          a,
          () => render(op.kids, []),
          () => clone(P),
        );
        return;
    }
  });
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("server mode regions resume", () => {
  it("property (seed 1337): a served tree resumes with no warning, keeping every server element, and updates in place", () => {
    fc.assert(
      fc.property(fc.array(ops, { maxLength: 3 }), (tree) => {
        document.body.innerHTML = "";
        const host = document.createElement("div");
        const served: { el: Element | null } = { el: null };
        serverMode.on = true;
        try {
          mount(() => {
            served.el = render(tree, []);
            return document.createComment("");
          }, host);
        } finally {
          serverMode.on = false;
        }
        if (served.el === null) throw new Error("fixture: nothing rendered");
        const html = served.el.outerHTML.replace("<div>", '<div data-k-island="T">');
        document.body.innerHTML = `${html}<script type="application/json" id="k-state">{"stores":{},"islands":{"T":{}}}</script>`;
        const before = [...document.body.querySelectorAll("*")];
        const flips: (() => void)[] = [];
        const { warnings } = resume(document.body, { T: () => render(tree, flips) });
        expect(warnings).toEqual([]);
        const after = [...document.body.querySelectorAll("*")];
        expect(after).toEqual(before);
        after.forEach((el, i) => expect(el).toBe(before[i]));
        const root = document.querySelector("[data-k-island]");
        for (const flip of flips) flip();
        expect(document.querySelector("[data-k-island]")).toBe(root);
        expect(document.querySelector("[data-k-error]")).toBeNull();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});
