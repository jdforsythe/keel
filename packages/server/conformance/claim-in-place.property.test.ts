// @vitest-environment happy-dom
// Spec: k.claim, In place "During `resume` a MutationObserver sees under island roots no element or region comment removed and no element added, unless an island mismatches (E1253) or writes state; text may be replaced and empty anchors added. So content of several items (a component's, a fragment's, an op's branch or row) keeps each served element in its region. A `resumeDocument` handle's `detached()` counts those removed, put back or not."
// Seed: 1337 (fc.assert below). Property: over random trees of components with one to four children, structural ops with
// multi-child branches and rows, fragments and text, a served page resumes with no element or region comment removed, no element added,
// each served element the same object in the same region, and `detached()` 0.
import { manifest } from "@keel/router";
import { resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import { SEED, compilePage, elementsIn, observed, regionElements, structural } from "./claim-support.ts";
import { elementsOf, expectKept, install, q, resumeBody, settle } from "./resume-app.ts";
import { serveRoutes } from "./resume-graph-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

type Tree =
  | { readonly t: "el" }
  | { readonly t: "text" }
  | { readonly t: "comp" | "if" | "match" | "boundary" | "frag" | "part"; readonly kids: readonly Tree[] }
  | { readonly t: "for"; readonly rows: number; readonly kids: readonly Tree[] };

const kids = (inner: fc.Arbitrary<Tree>): fc.Arbitrary<readonly Tree[]> =>
  fc.array(inner, { minLength: 1, maxLength: 4 });

const tree: fc.Arbitrary<Tree> = fc.letrec<{ node: Tree }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", maxDepth: 3 },
    fc.constant<Tree>({ t: "el" }),
    fc.constant<Tree>({ t: "text" }),
    fc.record({
      t: fc.constantFrom<"comp" | "if" | "match" | "boundary" | "frag" | "part">(
        "comp",
        "if",
        "match",
        "boundary",
        "frag",
        "part",
      ),
      kids: kids(tie("node")),
    }),
    fc.record({ t: fc.constant<"for">("for"), rows: fc.integer({ min: 1, max: 3 }), kids: kids(tie("node")) }),
  ),
})).node;

/** The TSX of one tree under the key `k`; every element has a unique id except a row's, which the `row` class names. */
function source(k: string, roots: readonly Tree[]): string {
  let next = 0;
  const id = (): string => `${k}.e${next++}`;
  const items = (ts: readonly Tree[], inRow: boolean): string => ts.map((t) => item(t, inRow)).join(" ");
  const item = (t: Tree, inRow: boolean): string => {
    switch (t.t) {
      case "el":
        return inRow ? `<b class="row">x</b>` : `<b id="${id()}">x</b>`;
      case "text":
        return inRow ? "row text" : "text {n.get()}";
      case "comp":
        return `<Wrap>${items(t.kids, inRow)}</Wrap>`;
      case "if":
        return `<If when={on.get()}>${items(t.kids, inRow)}</If>`;
      case "match":
        return `<Match on={view.get()}><Case tag="a">${items(t.kids, inRow)}</Case><Case tag="b"><p>other</p></Case></Match>`;
      case "boundary":
        return `<Boundary fallback={(e, reset) => <p>err</p>}>${items(t.kids, inRow)}</Boundary>`;
      case "frag":
        return `<div class="slot">{<>${items(t.kids, inRow)}</>}</div>`;
      case "part":
        return `<Part id="${id()}" role="generic">${items(t.kids, inRow)}</Part>`;
      case "for":
        return `<div class="rows"><For each={rows.get().slice(0, ${t.rows})} key="id">{(r) => <>${items(t.kids, true)}</>}</For></div>`;
    }
  };
  return `import { signal } from "@keel/reactive";
import { Boundary, Case, For, If, Match } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
function Wrap(props) { return <section class="wrap">{props.children()}</section> }
export default function Page() {
  const n = signal(0);
  const on = signal(true);
  const view = signal({ tag: "a" });
  const rows = signal([{ id: "r1" }, { id: "r2" }, { id: "r3" }]);
  return <div id="${k}.root">
    <button id="${k}.hit" onClick={() => n.set(n.get() + 1)}>hit</button><span id="${k}.out">{n.get()}</span>
    ${items(roots, false)}
  </div>
}
`;
}

const indexIn = (before: readonly Element[], lists: readonly (readonly Element[])[]): number[][] =>
  lists.map((l) => l.map((e) => before.indexOf(e)));

it("Property: over random trees of components, fragments and structural ops with several items, resume removes no element or region comment, adds no element, keeps each element in its region, and detached() is 0", async () => {
  let run = 0;
  await fc.assert(
    fc.asyncProperty(fc.array(tree, { minLength: 1, maxLength: 3 }), async (roots) => {
      run += 1;
      const k = `pp${run}`;
      const page = compilePage(`${k}.page`, source(k, roots));
      const routes = manifest({ [`${k}.page`]: { path: `/${k}`, component: page } });
      const doc = await serveRoutes(routes, [k], `/${k}`);
      expect(doc.status).toBe(200);

      install(doc);
      const before = elementsOf(document.body);
      const regions = indexIn(before, regionElements(document.body));
      const { result, seen } = observed(document.body, () => resumeBody({ [`${k}.page`]: page }, "production"));
      expect(result.warnings).toEqual([]);
      expect(structural(seen.removed)).toEqual([]);
      expect(elementsIn(seen.added)).toEqual([]);
      expectKept(before);
      expect(indexIn(before, regionElements(document.body))).toEqual(regions);
      q(`${k}.hit`).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await settle();
      expect(q(`${k}.out`).textContent).toBe("1");

      document.body.innerHTML = "";
      const t = await resumeDocument(doc.text, { routes });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      t.dispose();
    }),
    { seed: SEED, numRuns: 12 },
  );
}, 120_000);
