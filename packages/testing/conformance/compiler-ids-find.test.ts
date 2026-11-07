// @vitest-environment happy-dom
// Spec: k.compiler, clause "ids.json has exactly one entry per element in source, and each key is an id the harness find(id) resolves."
// Seed: 1337 (fc.assert seed below), numRuns: 100.
// The compiler package cannot import @keel/testing, so its own test uses getElementById; this one resolves through the harness.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compiled } from "./component-support.ts";
import { SEED, simCtx } from "./fixtures.ts";

const NoProps = s.object({});

interface Node_ {
  readonly tag: string;
  readonly explicit: boolean;
  readonly kids: readonly Node_[];
}

const leaf = (tag: string): fc.Arbitrary<Node_> => fc.boolean().map((explicit) => ({ tag, explicit, kids: [] }));

const li: fc.Arbitrary<Node_> = leaf("li");

const tree = (depth: number): fc.Arbitrary<Node_> => {
  const leaves = fc.oneof(leaf("span"), leaf("p"), leaf("button"));
  if (depth <= 0) return leaves;
  const sub = tree(depth - 1);
  const box = fc.record({
    tag: fc.constantFrom("div", "section"),
    explicit: fc.boolean(),
    kids: fc.array(sub, { maxLength: 3 }),
  });
  const list = fc.record({
    tag: fc.constant("ul"),
    explicit: fc.boolean(),
    kids: fc.array(li, { minLength: 1, maxLength: 3 }),
  });
  return fc.oneof(leaves, box, list);
};

const size = (n: Node_): number => 1 + n.kids.reduce((a, k) => a + size(k), 0);

interface Src {
  readonly tag: string;
  readonly id: string | undefined;
}

// Renders the tree to JSX source, listing elements in source (pre-)order with their explicit id, if any.
const toSource = (root: Node_): { readonly jsx: string; readonly elements: readonly Src[] } => {
  const elements: Src[] = [];
  let next = 0;
  const go = (n: Node_): string => {
    const id = n.explicit ? `x.a${next++}` : undefined;
    elements.push({ tag: n.tag, id });
    const attrs = id === undefined ? "" : ` id="${id}"`;
    const inner =
      n.tag === "button" || n.tag === "p" || n.tag === "span" || n.tag === "li" ? "t" : n.kids.map(go).join("");
    return `<${n.tag}${attrs}>${inner}</${n.tag}>`;
  };
  const jsx = go(root);
  return { jsx, elements };
};

describe("k.compiler: ids.json has exactly one entry per element in source, and each key is an id the harness find(id) resolves", () => {
  it("for any nested element tree, ids.json has one unique entry per source element and every key resolves through find(id)", () => {
    fc.assert(
      fc.property(
        tree(3).filter((t) => size(t) <= 10),
        (root) => {
          const { jsx, elements } = toSource(root);
          const c = compiled("Gen", `export default function Gen() { return ${jsx} }`, NoProps);
          expect(c.ids).toHaveLength(elements.length);
          expect(new Set(c.ids).size).toBe(c.ids.length);
          for (const e of elements) if (e.id !== undefined) expect(c.ids).toContain(e.id);
          // ids.json keys are emitted sorted, not in source order: map source element i to its key by id (explicit) or <File>.<i> (derived).
          elements.forEach((e, i) => {
            const key = e.id ?? `Gen.${i}`;
            expect(c.ids).toContain(key);
            expect(c.entries[key]?.tag).toBe(e.tag);
          });
          for (const k of c.ids) expect(/^(x\.a\d+|Gen\.\d+)$/.test(k)).toBe(true);
          const t = render(c.component, { props: {}, ctx: simCtx() });
          try {
            for (const id of c.ids) expect(t.find(id).id).toBe(id);
            expect(() => t.find("Gen.999")).toThrow(/E1705/);
          } finally {
            t.dispose();
          }
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("an element under <If when={true}> with an explicit id still has one entry and resolves through find(id)", () => {
    const c = compiled(
      "Cond",
      `import { If } from '@keel/runtime-dom'
export default function Cond() { return <div><span>a</span><If when={true}><section><button id="cond.go">Go</button></section></If></div> }`,
      NoProps,
    );
    expect(c.ids).toHaveLength(4);
    expect(new Set(c.ids).size).toBe(4);
    expect(c.ids).toContain("cond.go");
    expect(c.entries["cond.go"]?.tag).toBe("button");
    expect(c.ids.map((k) => c.entries[k]?.tag)).toEqual(["div", "span", "section", "button"]);
    const t = render(c.component, { props: {}, ctx: simCtx() });
    try {
      for (const id of c.ids) expect(t.find(id).id).toBe(id);
      expect(() => t.find("Cond.999")).toThrow(/E1705/);
    } finally {
      t.dispose();
    }
  });
});
