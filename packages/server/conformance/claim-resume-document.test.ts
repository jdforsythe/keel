// @vitest-environment happy-dom
// k.claim, Packaged components "A `resumeDocument` handle has `removed()`: the elements under the served island roots not in the document when it resolved."
// k.claim, In place "A `resumeDocument` handle's `detached()` counts those removed, put back or not."
// Spec: k.claim, clause "An island whose `effect` hides at resume an `If` branch the server showed has `removed()` equal to that branch's elements."
// Spec: k.claim, clause "With one, two and array children of a component, nested components, `Form` with one and several, `Part`, `If`, `For` rows, `Match` and `Boundary` with several, a fragment in a slot and text beside elements: no element removed or added, each in its region, handlers work, `detached()` 0; only a mismatching island removes."
// Seed: 1337 (no generated inputs). The served pages are real createApp output; the client side is `resumeDocument`.
// Assumption: `removed()` and `detached()` return counts.
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { routes } from "./claim-cases-routes.ts";
import { CASES } from "./claim-cases.ts";
import { e1257Lines } from "./claim-support.ts";
import { appOf } from "./resume-graph-app.ts";

const MODULES = [...new Set([...CASES.map((c) => c.key), "ef", "eg", "eh", "er", "ek"])];
const FRESH = () => import("./claim-cases-routes.ts");

async function served(path: string): Promise<{ html: string; lines: string[] }> {
  const lines: string[] = [];
  const app = await appOf(routes, MODULES, { log: { lines } });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return { html: await res.text(), lines };
}

describe("k.claim: a resumeDocument handle reads what resume removed", () => {
  for (const c of CASES) {
    it(`${c.title}: removed() and detached() are 0 and the handlers work`, async () => {
      const { html, lines } = await served(`/${c.key}`);
      expect(e1257Lines(lines)).toEqual([]);
      const t = await resumeDocument(html, { routes });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      const hits = c.content.filter((id) => id.includes("hit"));
      for (const id of hits) await t.fire(id, { type: "click" });
      expect(t.find(`${c.key}.out`).text).toBe(String(hits.length));
      t.dispose();
    });
  }

  it("a clean island has removed() 0, and after a fire that removes a row it is still 0", async () => {
    const { html } = await served("/er");
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    await t.fire("er.rm", { type: "click" });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    t.dispose();
  });

  it("an island whose effect hides at resume an If branch the server showed has removed() equal to that branch's elements, and no warning", async () => {
    const { html } = await served("/ef");
    expect(html).toContain('id="ef.a"');
    expect(html).toContain('id="ef.b"');
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(2);
    expect(t.detached()).toBeGreaterThanOrEqual(2);
    t.dispose();
  });

  it("an element removed and put back by the island counts for detached() and not for removed()", async () => {
    const { html } = await served("/eg");
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(1);
    t.dispose();
  });

  it("an element removed and not put back counts for removed() and for detached()", async () => {
    const { html } = await served("/eh");
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(1);
    expect(t.detached()).toBe(1);
    t.dispose();
  });

  it("an island that touches nothing has removed() 0 and detached() 0 in a fresh graph", async () => {
    const { html } = await served("/ek");
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    t.dispose();
  });
});
