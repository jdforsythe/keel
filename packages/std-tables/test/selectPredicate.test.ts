// @vitest-environment happy-dom
// `selected` alone decides the select column; the empty row spans exactly the rendered columns.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import { expect, test } from "vitest";
import { CELLS, LOCALE, TEXT, catalogColumns, serverHref, simCtx } from "../conformance/fixtures.ts";
import { DataTable } from "../src/DataTable.ts";

const pageOf = (extra: Record<string, unknown>) =>
  Object.assign(
    (): Node =>
      Reflect.apply(DataTable, undefined, [
        {
          id: "cat",
          label: "Catalog",
          columns: catalogColumns,
          search: {},
          href: serverHref,
          locale: LOCALE,
          rows: () => [],
          pageSize: 5,
          text: TEXT,
          cells: CELLS,
          empty: () => Text({ children: "None" }),
          ...extra,
        },
      ]),
    { Props: s.object({}) },
  );
const shown = catalogColumns.show.length;
const heads = (): number => document.getElementById("cat.columns")?.children.length ?? -1;

test("`selected` without `onSelect` has the select column, and the empty row spans it", () => {
  const t = render(pageOf({ selected: () => [] }), { props: {}, ctx: simCtx() });
  expect(document.getElementById("cat.selectAll")).not.toBeNull();
  expect(heads()).toBe(shown + 1);
  expect(document.getElementById("cat.empty.cell")?.getAttribute("colspan")).toBe(String(shown + 1));
  t.dispose();
});

test("`onSelect` without `selected` has no select column", () => {
  const t = render(pageOf({ onSelect: () => {} }), { props: {}, ctx: simCtx() });
  expect(document.getElementById("cat.selectAll")).toBeNull();
  expect(heads()).toBe(shown);
  expect(document.getElementById("cat.empty.cell")?.getAttribute("colspan")).toBe(String(shown));
  t.dispose();
});
