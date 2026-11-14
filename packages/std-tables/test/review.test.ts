// @vitest-environment happy-dom
// Keys never reach an element id unchecked, `q` past the schema's limit still filters, and `applyQuery` is total
// over a locale it cannot use. Seed 1337.
import { s } from "@keel/schema";
import { DataTable, applyQuery, columns, tableSearch } from "@keel/std-tables";
import { render, renderRoute } from "@keel/testing";
import { describe, expect, test } from "vitest";
import {
  CELLS,
  LOCALE,
  TEXT,
  catalogColumns,
  dataset,
  makeRows,
  routes,
  serverHref,
  simCtx,
  throwsCode,
  useRows,
} from "../conformance/fixtures.ts";

const PageOf = (page: ReturnType<typeof pageWith>) =>
  Object.assign(
    (): Node =>
      DataTable({
        id: "cat",
        label: "Catalog",
        columns: catalogColumns,
        search: {},
        href: serverHref,
        locale: LOCALE,
        page,
        text: TEXT,
        cells: CELLS,
      }),
    { Props: s.object({}) },
  );
const pageWith = (ids: readonly number[]) => {
  const rows = makeRows(3).map((r, i) => ({ ...r, id: ids[i] ?? r.id }));
  return { rows, total: rows.length, page: 1, pages: 1 };
};

describe("review fixes", () => {
  test("a marked key column is E2851, whatever marks it", () => {
    const Marked = s.object({ id: s.string().pii("identifier"), t: s.string() });
    expect(throwsCode(() => columns(Marked, { key: "id", show: ["t"] }))).toBe("E2851");
    const Whole = s.object({ id: s.int(), t: s.string() }).pii("content");
    expect(throwsCode(() => columns(Whole, { key: "id", show: ["t"] }))).toBe("E2851");
  });

  test("a server page with a repeated or unsafe key is E2853 before any id is written", () => {
    expect(
      throwsCode(() => render(PageOf(pageWith([1, 2, 3])), { props: {}, ctx: simCtx() }).dispose()),
    ).toBeUndefined();
    expect(throwsCode(() => render(PageOf(pageWith([1, 1, 3])), { props: {}, ctx: simCtx() }))).toBe("E2853");
    expect(throwsCode(() => render(PageOf(pageWith([1, 2.5, 3])), { props: {}, ctx: simCtx() }))).toBe("E2853");
    document.body.replaceChildren();
  });

  test("applyQuery over a locale it cannot use is E2853, with or without q and sort", () => {
    for (const search of [{}, { q: "a" }, { sort: "title" }])
      expect(
        throwsCode(() =>
          Reflect.apply(applyQuery, undefined, [
            catalogColumns,
            makeRows(3),
            search,
            { pageSize: 5, locale: "not a locale!!" },
          ]),
        ),
      ).toBe("E2853");
  });

  test("a search-only navigation keeps the page: the table and its status are the same nodes", async () => {
    useRows(12);
    const h = await renderRoute("tbl.find", { routes, params: {}, search: {}, ctx: simCtx() });
    const before = document.getElementById("cat.table");
    const status = document.getElementById("cat.status");
    await h.fire("cat.sort.title", { type: "click" });
    await h.settle();
    expect(document.getElementById("cat.table")).toBe(before);
    expect(document.getElementById("cat.status")).toBe(status);
    expect(h.find("cat.header.title").state.sort).toBe("ascending");
    h.dispose();
  });

  test("a query past 200 characters filters by its first 200 and keeps the input's text", async () => {
    useRows(12);
    const ctx = simCtx();
    const h = await renderRoute("tbl.find", { routes, params: {}, search: {}, ctx });
    const long = `item${"x".repeat(250)}`;
    await h.fire("find.input", { type: "input", value: long });
    ctx.clock.advance(300);
    await h.settle();
    expect(h.route()).toMatchObject({ search: { q: long.slice(0, 200) } });
    expect(tableSearch(catalogColumns).parse({ q: long.slice(0, 200) }).ok).toBe(true);
    expect(dataset.loads).toBeGreaterThan(0);
    expect(Reflect.get(document.getElementById("find.input") ?? {}, "value")).toBe(long);
    h.dispose();
  });

  test("a table that unmounts forgets its focused pager link", async () => {
    useRows(12);
    const h = await renderRoute("tbl.server", { routes, params: {}, search: { page: 2 }, ctx: simCtx() });
    await h.fire("cat.next", { type: "focus" });
    h.dispose();
    await Promise.resolve();
    const last = await renderRoute("tbl.server", { routes, params: {}, search: { page: 3 }, ctx: simCtx() });
    await last.settle();
    expect(document.activeElement?.id ?? "").not.toBe("cat.status");
    last.dispose();
  });
});

describe("marks inside a format", () => {
  const Email = s.format("Email", s.string().pii("contact"), {
    check: (v) => v.includes("@"),
    gen: { from: s.string({ min: 1 }), map: (v) => `${v}@x` },
  });
  test("a marked format search column is E2852 and a marked format key is E2851", () => {
    const Row = s.object({ id: s.int({ min: 1 }), email: Email });
    expect(throwsCode(() => tableSearch(columns(Row, { key: "id", show: ["email"], search: ["email"] })))).toBe(
      "E2852",
    );
    expect(throwsCode(() => columns(s.object({ email: Email, n: s.int() }), { key: "email", show: ["n"] }))).toBe(
      "E2851",
    );
  });
  test("a format column is never a filter: its kind is text, so E2851 comes first", () => {
    const Row = s.object({ id: s.int({ min: 1 }), email: Email });
    expect(
      throwsCode(() => Reflect.apply(columns, undefined, [Row, { key: "id", show: ["email"], filter: ["email"] }])),
    ).toBe("E2851");
  });
});
