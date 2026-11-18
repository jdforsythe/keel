// @vitest-environment happy-dom
// Spec: k.claim, Order "At resume each op claims the next server element when it runs, so an element is made inside the build of what holds it: an `element` fill, a slot, a structural op, or a thunk or render function one of them calls. An element made before and passed in (eager) claims its parent's server element: its island mismatches (E1253) and re-renders. Compiled JSX keeps the order: component children compile to a thunk, element-valued props to getters (k.compiler)."
// Spec: k.claim, In place "During `resume` a MutationObserver sees under island roots no element or region comment removed and no element added, unless an island mismatches (E1253) or writes state; text may be replaced and empty anchors added. So content of several items (a component's, a fragment's, an op's branch or row) keeps each served element in its region."
// Spec: k.claim, Conformance "With one, two and array children of a component, nested components, `Form` with one and several, `Part`, `If`, `For` rows, `Match` and `Boundary` with several, a fragment in a slot and text beside elements: no element removed or added, each in its region, handlers work, `detached()` 0; only a mismatching island removes."
// Seed: 1337 (no generated inputs; the property is in claim-in-place.property.test.ts). Real compiled TSX, real createApp, real resume.
// `detached()` is read through `resumeDocument` in claim-resume-document.test.ts, over the same pages.
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "./claim-cases-routes.ts";
import { CASES, pageOf } from "./claim-cases.ts";
import { elementsIn, observed, regionElements, structural } from "./claim-support.ts";
import { componentsOf, elementsOf, expectKept, install, q, resumeBody, settle } from "./resume-app.ts";
import { serve } from "./resume-app.ts";
import { serveRoutes } from "./resume-graph-app.ts";
import { TWO } from "./resume-test-app.ts";

const MODULES = [...new Set(CASES.map((c) => c.key))];

afterEach(() => {
  document.body.innerHTML = "";
});

const indexIn = (before: readonly Element[], lists: readonly (readonly Element[])[]): number[][] =>
  lists.map((l) => l.map((e) => before.indexOf(e)));

describe("k.claim: resume moves no served node, whatever the content holds", () => {
  for (const c of CASES) {
    it(`${c.title}: no element or region comment removed, no element added, each served element in its region, handlers work`, async () => {
      const doc = await serveRoutes(routes, MODULES, `/${c.key}`);
      expect(doc.status).toBe(200);
      install(doc);
      const before = elementsOf(document.body);
      const regions = indexIn(before, regionElements(document.body));
      for (const id of c.content) expect(before).toContain(q(id));

      const { result, seen } = observed(document.body, () =>
        resumeBody({ [`${c.key}.page`]: pageOf(c) }, "production"),
      );

      expect(result.warnings).toEqual([]);
      expect(result.console).toEqual([]);
      expect(structural(seen.removed)).toEqual([]);
      expect(elementsIn(seen.added)).toEqual([]);
      expectKept(before);
      expect(indexIn(before, regionElements(document.body))).toEqual(regions);

      let clicks = 0;
      for (const id of c.content) {
        if (!id.includes("hit")) continue;
        q(id).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await settle();
        clicks += 1;
        expect(q(`${c.key}.out`).textContent).toBe(String(clicks));
      }
      expect(clicks).toBeGreaterThan(0);
      q(`${c.key}.inc`).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await settle();
      expect(q(`${c.key}.out`).textContent).toBe(String(clicks + 1));
    });
  }

  it("only a mismatching island removes: its own server elements go and its neighbour's stay", async () => {
    install(await serve(TWO, "/two"));
    const pageBefore = elementsOf(q("ap.root")).concat(q("ap.root"));
    const layoutBefore = elementsOf(document.body).filter((e) => !pageBefore.includes(e));
    const mismatch = {
      "ap.page": `import { signal } from "@keel/reactive";
export default function Page(props) {
  const n = signal(0);
  return <div id="ap.root"><h3>{props.data.title}</h3><aside id="ap.extra">extra</aside><button id="ap.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="ap.out">{n.get()}</span></div>
}
`,
    };

    const { result, seen } = observed(document.body, () => resumeBody(componentsOf(TWO, mismatch), "dev"));

    expect(result.warnings.map((w) => String(Reflect.get(Object(w), "code") ?? w))).toEqual(
      expect.arrayContaining([expect.stringContaining("E1253")]),
    );
    const removed = elementsIn(seen.removed);
    expect(removed.length).toBeGreaterThan(0);
    for (const el of removed) expect(pageBefore).toContain(el);
    for (const el of layoutBefore) {
      expect(el.isConnected).toBe(true);
      expect(removed).not.toContain(el);
    }
  });
});
