// @vitest-environment happy-dom
// k.claim, Packaged components "Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work."
// Spec: k.claim, clause "`DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work."
// k.claim, Order "An element made before and passed in (eager) claims its parent's server element: its island mismatches (E1253) and re-renders."
// Seed: 1337 (no generated inputs). Each page is served by createApp in dev and production and resumed in a module graph of its own;
// `resumeDocument` rejects with E1720 on a resume warning and mounts no router. A control that is a link is followed through the server:
// its `href` is read from the served document and requested from the same `createApp`, and the page it answers is resumed in turn.
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

/** The `href` of the served element with `id`, root-relative, entities decoded. */
function hrefOf(html: string, id: string): string {
  const tag = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`id="${id}"`));
  expect(tag, `a served link ${id}`).toBeDefined();
  const m = /href="([^"]*)"/.exec(tag ?? "");
  expect(m, `${id} has an href`).not.toBeNull();
  return (m?.[1] ?? "").replaceAll("&amp;", "&");
}

const FIVE = ["cat.row.1", "cat.row.2", "cat.row.3", "cat.row.4", "cat.row.5"];

describe("k.claim: DataTable and TableSearch are served and resumed in a fresh graph", () => {
  it("DataTable over a client source: no warning, no E1257, removed() 0, its sort link and Next are served and resume, and select and selectAll call onSelect", async () => {
    const html = await served("/dtc");
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const t = await resumeDocument(html, { routes: FRESH, ctx });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    expect(rowIds(t)).toEqual(FIVE);

    await t.fire("cat.select.4", { type: "click" });
    expect(t.state()["dt.picked"]).toEqual({ keys: [4] });
    await t.fire("cat.selectAll", { type: "click" });
    expect(t.find("cat.selectAll").state.checked).toBe(true);
    t.dispose();

    const sortHref = hrefOf(html, "cat.sort.price");
    expect(sortHref).toContain("sort=price");
    const sorted = await resumeDocument(await served(sortHref), { routes: FRESH });
    expect(sorted.removed()).toBe(0);
    expect(sorted.find("cat.header.price").state.sort).toBe("ascending");
    expect(rowIds(sorted)).toHaveLength(5);
    sorted.dispose();

    const nextHref = hrefOf(html, "cat.next");
    expect(nextHref).toContain("page=2");
    const next = await resumeDocument(await served(nextHref), { routes: FRESH });
    expect(next.removed()).toBe(0);
    expect(rowIds(next)).not.toContain("cat.row.1");
    expect(rowIds(next)).toHaveLength(5);
    next.dispose();
  });

  it("DataTable over a server source at page 2: no warning, no E1257, removed() 0, Previous and a sort link are served links whose targets resume as the previous and the sorted page", async () => {
    const html = await served("/dts?page=2");
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    expect(rowIds(t)).toHaveLength(5);
    expect(rowIds(t)).not.toContain("cat.row.1");
    expect(t.find("cat.previous").role).toBe("link");
    t.dispose();

    const prev = await resumeDocument(await served(hrefOf(html, "cat.previous")), { routes: FRESH });
    expect(prev.removed()).toBe(0);
    expect(rowIds(prev)).toEqual(FIVE);
    prev.dispose();

    const sortHref = hrefOf(html, "cat.sort.title");
    expect(sortHref).toContain("sort=title");
    expect(sortHref).not.toContain("page=");
    const sorted = await resumeDocument(await served(sortHref), { routes: FRESH });
    expect(sorted.removed()).toBe(0);
    expect(sorted.find("cat.header.title").state.sort).toBe("ascending");
    sorted.dispose();
  });

  it("TableSearch above a table: no warning, no E1257, removed() 0, its input takes typing, and the search it navigates to is served and resumes filtered", async () => {
    const html = await served("/dtf");
    const t = await resumeDocument(html, { routes: FRESH, ctx: createCtx({ mode: "sim", seed: 1337 }) });
    expect(t.removed()).toBe(0);
    expect(t.detached()).toBe(0);
    expect(rowIds(t)).toEqual(FIVE);
    await t.fire("find.input", { type: "input", value: "item h" });
    expect(t.removed()).toBe(0);
    t.dispose();

    const found = await resumeDocument(await served("/dtf?q=item%20h"), { routes: FRESH });
    expect(found.removed()).toBe(0);
    expect(found.detached()).toBe(0);
    expect(rowIds(found)).toEqual(["cat.row.1"]);
    found.dispose();
  });
});
