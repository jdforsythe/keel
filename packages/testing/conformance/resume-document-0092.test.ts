// @vitest-environment happy-dom
// Spec: k.testing, clause "`resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers; an island missing from `routes` is E1720; an island whose component throws `new Error('boom')` while claiming is E1720 whose text holds `boom`."
// k.testing, rule E1720 (`resumeDocument`).
// Property seed: 1337 (fc.assert seed below).
// Assumption: `@keel/server` is not a dependency of this package, so the island document is written by hand in the shape k.runtime
// gives a server document: `data-k-island="<route id>"` on the island root, one `#k-state` script with `islands`; the island root
// is a real compiled component rendered by `mount`, as in runtime-resume-state-fire.test.ts.
import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { resumeDocument } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compiled } from "./component-support.ts";
import { codeOf, SEED, simCtx, thrown } from "./fixtures.ts";

const ROUTE = "rd.page";
const SOURCE = `
import { signal } from "@keel/reactive";
import { s } from "@keel/schema";

export const Props = s.object({ label: s.string() });

export default function ResumeDoc(props: { label: string }) {
  const n = signal(0);
  return (
    <div id="rd.root">
      <p id="rd.n">{n.get()}</p>
      <button id="rd.go" onClick={() => n.set(n.get() + 1)}>{props.label}</button>
    </div>
  );
}
`;
const c = compiled<{ readonly label: string }>("ResumeDoc", SOURCE, s.object({ label: s.string() }));

const islandHtml = (label: string): string => {
  const scratch = document.createElement("div");
  const dispose = mount((_p: Readonly<Record<string, unknown>>, ctx: Ctx) => c.component({ label }, ctx), scratch, {
    ctx: simCtx(),
  });
  const root = scratch.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  root.setAttribute("data-k-island", ROUTE);
  const html = root.outerHTML;
  dispose();
  return html;
};

const documentOf = (label: string, islands: Record<string, unknown>): string =>
  `<!doctype html><html><head><title>t</title></head><body>${islandHtml(label)}<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands })}</script></body></html>`;

const island = (p: Readonly<Record<string, unknown>>, ctx: Ctx): Node => {
  const label = p.label;
  if (typeof label !== "string") throw new Error("fixture: island props lack a label");
  return c.component({ label }, ctx);
};
const routesWith = (id: string) =>
  manifest(contract(id.split(".")[0] ?? "rd", { [id]: { path: "/rd" } }), { [id]: { component: island } });

describe("k.testing: resumeDocument", () => {
  it("`resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("Go", "Add", "Bump"), fc.integer({ min: 0, max: 5 }), async (label, clicks) => {
        const t = await resumeDocument(documentOf(label, { [ROUTE]: { label } }), {
          routes: routesWith(ROUTE),
          ctx: simCtx(),
        });
        expect(t.find("rd.go").text).toBe(label);
        expect(t.find("rd.n").text).toBe("0");
        for (let i = 0; i < clicks; i++) await t.fire("rd.go", { type: "click" });
        expect(t.find("rd.n").text).toBe(String(clicks));
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("an island missing from `routes` is E1720", async () => {
    const err = await thrown(() =>
      resumeDocument(documentOf("Go", { [ROUTE]: { label: "Go" } }), {
        routes: routesWith("rd.other"),
        ctx: simCtx(),
      }),
    );
    expect(codeOf(err)).toBe("E1720");
  });

  it("E1720 (`resumeDocument`): island state that fails its schema rejects with E1720", async () => {
    const err = await thrown(() =>
      resumeDocument(documentOf("Go", { [ROUTE]: { label: 7 } }), { routes: routesWith(ROUTE), ctx: simCtx() }),
    );
    expect(codeOf(err)).toBe("E1720");
  });

  it("E1720 is not raised for a document whose islands all resume (ctx defaults to a sim ctx)", async () => {
    const t = await resumeDocument(documentOf("Go", { [ROUTE]: { label: "Go" } }), { routes: routesWith(ROUTE) });
    expect(t.find("rd.go").text).toBe("Go");
    t.dispose();
  });
});
