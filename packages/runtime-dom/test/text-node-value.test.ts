// @vitest-environment happy-dom
// Property seed: 1337. rfc:0061 (backlog 0175): a `text` binding that receives a node, or an array holding one
// at any depth, renders nothing; it never writes "[object …]" or a node's markup as text. Other values keep
// their `String` form.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, template, text } from "../src/ops/index.ts";
import { SEED, rootSignal } from "./support.ts";

const T = template('<p id="p"> </p>');
const node = fc.constantFrom("b", "i", "span").map((t) => document.createElement(t));
const plain = fc.oneof(
  fc.string().filter((s) => !s.includes("[object") && !s.includes("<")),
  fc.integer(),
  fc.constant(null),
  fc.constant(undefined),
);
const leaf = fc.oneof(plain, node);
const value = fc.oneof(
  leaf,
  fc.array(leaf, { maxLength: 4 }),
  fc.array(fc.array(leaf, { maxLength: 3 }), { maxLength: 3 }),
);

const holdsNode = (v: unknown): boolean => v instanceof Node || (Array.isArray(v) && v.some(holdsNode));
const expected = (v: unknown): string => (v === null || v === undefined || holdsNode(v) ? "" : String(v));

/** Mounts a `text` binding over a signal and returns the paragraph's text after each value in `seq`. */
function render(seq: readonly unknown[]): string[] {
  const s = rootSignal<unknown>(seq[0]);
  const host = document.createElement("div");
  const dispose = mount(() => {
    const p = clone(T);
    Reflect.apply(text, undefined, [p, () => s.get()]);
    return p;
  }, host);
  const out: string[] = [];
  for (const v of seq) {
    s.set(v);
    out.push(host.querySelector("#p")?.textContent ?? "<missing>");
  }
  dispose();
  return out;
}

describe("text renders nothing for a node or an array holding one (rfc:0061)", () => {
  it("over arbitrary strings, numbers, nodes and arrays mixing them, text never holds '[object' or a node", () => {
    fc.assert(
      fc.property(fc.array(value, { minLength: 1, maxLength: 6 }), (seq) => {
        const got = render(seq);
        for (const [i, v] of seq.entries()) {
          expect(got[i]).toBe(expected(v));
          expect(got[i]).not.toContain("[object");
          expect(got[i]).not.toContain("<");
        }
        expect(document.body.querySelectorAll("b, i, span").length).toBe(0);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("the backlog 0175 repro: a node, then a nested array with a node, then text", () => {
    expect(render([document.createElement("b"), [["a", document.createElement("i")]], "ok", [1, 2]])).toEqual([
      "",
      "",
      "ok",
      "1,2",
    ]);
  });
});
