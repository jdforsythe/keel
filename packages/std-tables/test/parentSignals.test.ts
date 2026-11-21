// @vitest-environment happy-dom
// Rows and a selection read from a parent component's signals update the table, never re-run the parent.
import type { Ctx } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Button, Text } from "@keel/ui";
import { expect, test } from "vitest";
import { CELLS, LOCALE, TEXT, catalogColumns, makeRows, serverHref, simCtx } from "../conformance/fixtures.ts";
import { DataTable } from "../src/DataTable.ts";

const Page = Object.assign((_props: Record<string, never>, _ctx: Ctx): Node => view(), {
  Props: s.object({}),
});
let runs = 0;
const view = (): Node => {
  runs += 1;
  const n = signal(2);
  const picked = signal<readonly number[]>([1]);
  return Box({
    children: () => [
      Button({ id: "more", onClick: () => n.set(n.get() + 1), children: "More" }),
      Text({ id: "echo", children: () => computed(() => String(n.get())) }),
      DataTable({
        id: "cat",
        label: "Catalog",
        columns: catalogColumns,
        search: {},
        href: serverHref,
        locale: LOCALE,
        rows: () => makeRows(n.get()),
        pageSize: 5,
        selected: () => picked.get(),
        onSelect: (keys) => picked.set(keys.map(Number)),
        text: TEXT,
        cells: CELLS,
      }),
    ],
  });
};

test("a parent signal read by `rows` and `selected` updates the table in place", async () => {
  const t = render(Page, { props: {}, ctx: simCtx() });
  await t.fire("more", { type: "focus" });
  await t.fire("more", { type: "click" });
  expect(runs).toBe(1);
  expect(t.find("echo").text).toBe("3");
  expect(t.a11y("cat.body").children.map((c) => c.id)).toEqual(["cat.row.1", "cat.row.2", "cat.row.3"]);
  expect(t.find("more").state.focused).toBe(true);
  await t.fire("cat.select.2", { type: "click" });
  expect(runs).toBe(1);
  expect(t.find("cat.select.2").state.checked).toBe(true);
  expect(t.find("cat.selectAll").state.checked).toBe("mixed");
  t.dispose();
});
