// @vitest-environment happy-dom
// Property tests for compile(). Seed 1337.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;

type Tree = { tag: string; id: string | null; title: boolean; kids: (Tree | string)[] };

const word = fc.stringMatching(/^[a-z]{1,6}$/);
const tag = fc.constantFrom("div", "span", "p", "section", "b", "i", "em");
const leaf = fc.oneof(word, fc.constant("{v.get()}"), fc.constant('{" "}'));
const tree: fc.Arbitrary<Tree> = fc.letrec<{ node: Tree }>((t) => ({
  node: fc.record({
    tag,
    id: fc.option(fc.constant("x"), { freq: 4 }),
    title: fc.boolean(),
    kids: fc.array(fc.oneof({ depthSize: "small" }, leaf, t("node")), { maxLength: 4 }),
  }),
})).node;

/** Render a tree to JSX; explicit ids are made unique by appending a counter. */
function jsx(t: Tree, n: { i: number }, ids: string[]): string {
  let attrs = "";
  if (t.id !== null) {
    const id = `cmp.${t.id}${n.i++}`;
    ids.push(id);
    attrs += ` id="${id}"`;
  }
  if (t.title) attrs += " title={v.get()}";
  const kids = t.kids.map((k) => (typeof k === "string" ? k : jsx(k, n, ids))).join("");
  return `<${t.tag}${attrs}>${kids}</${t.tag}>`;
}

function count(t: Tree): number {
  return 1 + t.kids.reduce((s, k) => s + (typeof k === "string" ? 0 : count(k)), 0);
}

function source(body: string): string {
  return `import { signal } from '@keel/reactive'\nconst v = signal('s')\nexport default function R() { return ${body} }\n`;
}

describe("compile properties", () => {
  it("is deterministic: compiling random JSX twice yields identical outputs, artifacts, hashes, diagnostics", () => {
    fc.assert(
      fc.property(tree, (t) => {
        const files = [{ path: "R.tsx", source: source(jsx(t, { i: 0 }, [])) }];
        expect(JSON.stringify(compile(files))).toBe(JSON.stringify(compile(files)));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("puts every element of a random source in ids.json exactly once, and each id resolves after mount", () => {
    fc.assert(
      fc.property(tree, (t) => {
        const explicit: string[] = [];
        const r = compile([{ path: "R.tsx", source: source(jsx(t, { i: 0 }, explicit)) }]);
        expect(r.diagnostics).toEqual([]);
        const ids = Object.keys(r.artifacts["ids.json"]);
        expect(ids.length).toBe(count(t));
        for (const id of explicit) expect(ids).toContain(id);
        const C = evaluate(r.outputs[0]?.code ?? "");
        if (typeof C !== "function") throw new Error("no component");
        const host = document.createElement("div");
        document.body.append(host);
        const dispose = mount(() => C(), host);
        expect(host.querySelectorAll("*").length).toBe(ids.length);
        for (const id of ids)
          expect(document.getElementById(id)?.tagName.toLowerCase()).toBe(r.artifacts["ids.json"][id]?.tag);
        dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("never turns a hostile string literal into elements, as a static child or static attribute", () => {
    const hostile = fc.oneof(
      fc.constantFrom(
        "<script>alert(1)</script>",
        '"><img src=x onerror=alert(1)>',
        "</p><b>x</b>",
        "&lt;b&gt;",
        "<!-- -->",
      ),
      fc.string(),
      fc
        .tuple(fc.string(), fc.constantFrom("<script>", '"><img onerror=x>', "<svg onload=x>"), fc.string())
        .map((x) => x.join("")),
    );
    fc.assert(
      fc.property(hostile, (str) => {
        const lit = JSON.stringify(str);
        const r = compile([
          { path: "H.tsx", source: `export default function H() { return <div><p title={${lit}}>{${lit}}</p></div> }` },
        ]);
        expect(r.diagnostics).toEqual([]);
        const H = evaluate(r.outputs[0]?.code ?? "");
        if (typeof H !== "function") throw new Error("no component");
        const host = document.createElement("div");
        const dispose = mount(() => H(), host);
        const p = host.querySelector("p");
        expect(host.querySelectorAll("*").length).toBe(2);
        expect(p?.textContent).toBe(str);
        expect(p?.getAttribute("title")).toBe(str);
        dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
