// @vitest-environment happy-dom
// Spec: k.claim, Packaged components "Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work."
// Spec: k.claim, Conformance "`DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work."
// Spec: k.claim, Order "An element made before and passed in (eager) claims its parent's server element: its island mismatches (E1253) and re-renders."
// Seed: 1337 (no generated inputs). Each page is served by createApp in dev and production and resumed in a module graph of its own;
// `resumeDocument` rejects with E1720 on a resume warning. A resumed island is driven through the harness's router for its links.
import { createCtx } from "@keel/ctx";
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { MODULES, routes } from "./resume-datatable-routes.ts";
import { e1257, serve } from "./resume-support.ts";

const FRESH = () => import("./resume-datatable-routes.ts");
const rowIds = (t: Awaited<ReturnType<typeof resumeDocument>>): string[] =>
  t.a11y("cat.body").children.map((c) => c.id);

async function served(path: string) {
  for (const mode of ["dev", "production"] as const) {
    const s = await serve(routes, MODULES, path, { mode, requests: 2 });
    expect(s.status).toBe(200);
    expect(e1257(s)).toEqual([]);
  }
  const s = await serve(routes, MODULES, path, { mode: "production" });
  return s.text;
}

describe("k.claim: DataTable and TableSearch are served and resumed in a fresh graph", () => {
  it("DataTable over a client source: no warning, no E1257, removed() 0, a sort link re-sorts, Next moves to page 2, and select and selectAll call onSelect", async () => {
    const t = await resumeDocument(await served("/dtc"), {
      routes: FRESH,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
    });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    expect(rowIds(t)).toEqual(["cat.row.1", "cat.row.2", "cat.row.3", "cat.row.4", "cat.row.5"]);

    await t.fire("cat.sort.price", { type: "click" });
    expect(t.find("cat.header.price").state.sort).toBe("ascending");

    await t.fire("cat.next", { type: "click" });
    expect(rowIds(t)).not.toContain("cat.row.1");
    expect(rowIds(t)).toHaveLength(5);

    await t.fire("cat.select.6", { type: "click" });
    expect(t.state()["dt.picked"]).toEqual({ keys: [6] });
    await t.fire("cat.selectAll", { type: "click" });
    expect(t.find("cat.selectAll").state.checked).toBe(true);
    t.dispose();
  });

  it("DataTable over a server source at page 2: no warning, no E1257, removed() 0, Previous and a sort link are links the router follows and the next page renders", async () => {
    const t = await resumeDocument(await served("/dts?page=2"), { routes: FRESH });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    expect(rowIds(t)).toHaveLength(5);
    expect(rowIds(t)).not.toContain("cat.row.1");
    expect(t.find("cat.previous").role).toBe("link");

    await t.fire("cat.previous", { type: "click" });
    expect(rowIds(t)).toEqual(["cat.row.1", "cat.row.2", "cat.row.3", "cat.row.4", "cat.row.5"]);

    await t.fire("cat.sort.title", { type: "click" });
    expect(t.find("cat.header.title").state.sort).toBe("ascending");
    t.dispose();
  });

  it("TableSearch above a table: no warning, no E1257, removed() 0, typing then 300 ms of sim clock navigates once", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const t = await resumeDocument(await served("/dtf"), { routes: FRESH, ctx });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    const before = t.state()["dt.typed"];
    await t.fire("find.input", { type: "input", value: "item" });
    ctx.clock.advance(299);
    await t.settle();
    expect(t.state()["dt.typed"]).toEqual(before);
    ctx.clock.advance(1);
    await t.settle();
    expect(t.state()["dt.typed"]).toEqual({ q: "item" });
    t.dispose();
  });
});
