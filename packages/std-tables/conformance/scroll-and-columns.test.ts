// @vitest-environment happy-dom
// Spec: std.tables, clause "With `scroll=\"x\"` and `label=\"Recipes\"`, `<id>.scroll` is a `div` with `role=\"region\"`, `tabindex=\"0\"` and `aria-label=\"Recipes\"` whose one child is `<id>.table`, and `<id>.pager` is outside it; with `labelledBy=\"h\"`, both carry `aria-labelledby=\"h\"`; without `scroll`, `<id>.table`'s parent is `<id>`."
// Spec: std.tables, clause "`styles={{ cell: { px: '2', textAlign: 'start' }, 'column.price': { textAlign: 'end' } }}` gives `header.price` and every `cell.<key>.price` the `textAlign` `end` class and not the `start` one, keeps their `px` `2` class, and gives no other column the `end` class; `'column.nope'` is E2851."
// Seed: 1337.
// Not built yet (rfc:0203): the cases fail until `DataTable` takes `scroll` and `column.<col>` styles; plain `test`, not skipped. `tsc` reports those props as unknown until then.
// Assumptions: the id of the region is `<id>.scroll` as the spec says; the class names of `textAlign` and `px` are read from `compileStyles` over the same tokens, so no naming is assumed;
// "both carry `aria-labelledby`" is `<id>.scroll` and `<id>.table`; E2851 is thrown by `DataTable` and reaches `renderRoute` as a rejection whose message or `code` holds it.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { DataTable } from "@keel/std-tables";
import { renderRoute } from "@keel/testing";
import { defineTokens } from "@keel/ui";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  CELLS,
  LOCALE,
  PAGE_SIZE,
  SEED,
  Search,
  TEXT,
  attr,
  catalogColumns,
  makeRows,
  queryOf,
  simCtx,
} from "./fixtures.ts";

const tokens = defineTokens({
  color: { fg: { light: "#111", dark: "#eee" }, bg: { light: "#fff", dark: "#111" } },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "16px" },
  breakpoint: { md: "768px" },
});
const classOf = (props: Record<string, string>): string => {
  const c = compileStyles({ tokens, usages: [{ props }] }).classes[0]?.[0];
  if (c === undefined) throw new Error("fixture: no class compiled");
  return c;
};

const SHOWN = ["title", "price", "minutes", "added", "favorite"] as const;
type Scroll =
  | { scroll: "x"; label: string }
  | { scroll: "x"; labelledBy: string }
  | { label: string }
  | { labelledBy: string };
type Styles = NonNullable<Parameters<typeof DataTable>[0]["styles"]>;

const tbl = contract("tbl", { "tbl.view": { path: "/view", params: s.object({}), search: Search } });
let current: () => Node = () => document.createTextNode("");
const routes = manifest(tbl, { "tbl.view": { component: () => current() } });

const rows = makeRows(12);
const table = (name: Scroll, styles?: Styles, extra: Readonly<Record<string, unknown>> = {}): Node =>
  DataTable({
    id: "cat",
    ...name,
    columns: catalogColumns,
    search: queryOf({ sort: "title", dir: "asc" }),
    href: (q) => tbl.href("tbl.view", {}, q),
    locale: LOCALE,
    rows: () => rows,
    pageSize: PAGE_SIZE,
    text: TEXT,
    cells: CELLS,
    ...(styles === undefined ? {} : { styles }),
    ...extra,
  });

const view = async (make: () => Node) => {
  current = make;
  return renderRoute("tbl.view", { routes, params: {}, search: { sort: "title", dir: "asc" }, ctx: simCtx() });
};

const codeOfRender = async (make: () => Node): Promise<string | undefined> => {
  try {
    const h = await view(make);
    h.dispose();
    return undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const m = /E\d{4}/.exec(message)?.[0];
    if (m !== undefined) return m;
    return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : "no-code";
  }
};

describe("std.tables: the scroll part", () => {
  test('With `scroll="x"` and `label="Recipes"`, `<id>.scroll` is a `div` with `role="region"`, `tabindex="0"` and `aria-label="Recipes"` whose one child is `<id>.table`', async () => {
    const h = await view(() => table({ scroll: "x", label: "Recipes" }));
    const el = document.getElementById("cat.scroll");
    expect(el?.tagName).toBe("DIV");
    expect(el?.getAttribute("role")).toBe("region");
    expect(el?.getAttribute("tabindex")).toBe("0");
    expect(el?.getAttribute("aria-label")).toBe("Recipes");
    expect(el?.children).toHaveLength(1);
    expect(el?.children[0]?.id).toBe("cat.table");
    h.dispose();
  });

  test("`<id>.pager` is outside the scroll region", async () => {
    const h = await view(() => table({ scroll: "x", label: "Recipes" }));
    const region = document.getElementById("cat.scroll");
    const pager = document.getElementById("cat.pager");
    expect(pager).not.toBeNull();
    expect(region?.contains(pager)).toBe(false);
    expect(document.getElementById("cat")?.contains(pager)).toBe(true);
    h.dispose();
  });

  test('with `labelledBy="h"`, `<id>.scroll` and `<id>.table` both carry `aria-labelledby="h"`', async () => {
    const h = await view(() => table({ scroll: "x", labelledBy: "h" }));
    expect(attr("cat.scroll", "aria-labelledby")).toBe("h");
    expect(attr("cat.table", "aria-labelledby")).toBe("h");
    expect(attr("cat.scroll", "aria-label")).toBeNull();
    h.dispose();
  });

  test("with `scroll` and a `label`, the table carries the same `aria-label` as the region", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/), async (label) => {
        const h = await view(() => table({ scroll: "x", label }));
        expect(attr("cat.scroll", "aria-label")).toBe(label);
        expect(attr("cat.table", "aria-label")).toBe(label);
        h.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("without `scroll`, `<id>.table`'s parent is `<id>` and no `<id>.scroll` exists", async () => {
    for (const name of [{ label: "Recipes" }, { labelledBy: "h" }]) {
      const h = await view(() => table(name));
      expect(document.getElementById("cat.table")?.parentElement?.id).toBe("cat");
      expect(document.getElementById("cat.scroll")).toBeNull();
      h.dispose();
    }
  });
});

describe("std.tables: column styles", () => {
  const styles: Styles = { cell: { px: "2", textAlign: "start" }, "column.price": { textAlign: "end" } };
  // Computed inside each case: until `textAlign` is built, compiling it throws, and each case then fails on its own.
  const cls = (id: string): string[] => [...(document.getElementById(id)?.classList ?? [])];

  test("`column.price` gives `header.price` and every `cell.<key>.price` the `textAlign` `end` class and not the `start` one, and keeps their `px` `2` class", async () => {
    const [end, start, px2] = [classOf({ textAlign: "end" }), classOf({ textAlign: "start" }), classOf({ px: "2" })];
    const h = await view(() => table({ label: "Catalog" }, styles));
    const keys = h.a11y("cat.body").children.map((c) => c.id.replace("cat.row.", ""));
    expect(keys).toHaveLength(PAGE_SIZE);
    for (const id of ["cat.header.price", ...keys.map((k) => `cat.cell.${k}.price`)]) {
      expect(cls(id)).toContain(end);
      expect(cls(id)).not.toContain(start);
    }
    for (const k of keys) expect(cls(`cat.cell.${k}.price`)).toContain(px2);
    h.dispose();
  });

  test("`column.price` gives no other column the `end` class, and the `cell` set still applies to them", async () => {
    const [end, start, px2] = [classOf({ textAlign: "end" }), classOf({ textAlign: "start" }), classOf({ px: "2" })];
    const h = await view(() => table({ label: "Catalog" }, styles));
    const keys = h.a11y("cat.body").children.map((c) => c.id.replace("cat.row.", ""));
    for (const col of SHOWN.filter((c) => c !== "price")) {
      expect(cls(`cat.header.${col}`)).not.toContain(end);
      for (const k of keys) {
        expect(cls(`cat.cell.${k}.${col}`)).not.toContain(end);
        expect(cls(`cat.cell.${k}.${col}`)).toContain(start);
        expect(cls(`cat.cell.${k}.${col}`)).toContain(px2);
      }
    }
    h.dispose();
  });

  test("for any shown column, `column.<col>` puts its `end` class on that header and its cells only (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...SHOWN), async (col) => {
        const end = classOf({ textAlign: "end" });
        const h = await view(() =>
          table({ label: "Catalog" }, undefined, { styles: { [`column.${col}`]: { textAlign: "end" } } }),
        );
        const keys = h.a11y("cat.body").children.map((c) => c.id.replace("cat.row.", ""));
        for (const other of SHOWN) {
          const want = other === col;
          expect(cls(`cat.header.${other}`).includes(end)).toBe(want);
          for (const k of keys) expect(cls(`cat.cell.${k}.${other}`).includes(end)).toBe(want);
        }
        h.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`'column.nope'` is E2851", async () => {
    expect(
      await codeOfRender(() =>
        table({ label: "Catalog" }, undefined, { styles: { "column.nope": { textAlign: "end" } } }),
      ),
    ).toBe("E2851");
  });

  test("any `column.<col>` key outside the shown columns is E2851, and a shown one is not (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{2,10}$/), async (col) => {
        const shown = SHOWN.some((c) => c === col);
        const code = await codeOfRender(() =>
          table({ label: "Catalog" }, undefined, { styles: { [`column.${col}`]: { textAlign: "end" } } }),
        );
        expect(code).toBe(shown ? undefined : "E2851");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
