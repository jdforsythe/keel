// @vitest-environment happy-dom
// `selected` alone decides the select column; the empty row holds the `empty` content.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import { expect, test } from "vitest";
import { DataTable } from "../src/DataTable.ts";
import { CELLS, LOCALE, TEXT, catalogColumns, serverHref, simCtx } from "./support.ts";

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
const heads = (t: ReturnType<typeof render>): number => t.a11y("cat.columns").children.length;

test("`selected` without `onSelect` has the select column, and the empty row shows the empty content", () => {
  const t = render(pageOf({ selected: () => [] }), { props: {}, ctx: simCtx() });
  expect(t.find("cat.selectAll").id).toBe("cat.selectAll");
  expect(heads(t)).toBe(shown + 1);
  expect(t.find("cat.empty.cell").text).toBe("None");
  t.dispose();
});

test("`onSelect` without `selected` has no select column", () => {
  const t = render(pageOf({ onSelect: () => {} }), { props: {}, ctx: simCtx() });
  expect(() => t.find("cat.selectAll")).toThrow(/E1705/);
  expect(heads(t)).toBe(shown);
  expect(t.find("cat.empty.cell").text).toBe("None");
  t.dispose();
});
