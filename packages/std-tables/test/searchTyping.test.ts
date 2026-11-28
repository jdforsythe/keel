// @vitest-environment happy-dom
// TableSearch keeps its input while its navigation loads (the page is kept across a search-only navigation), and its
// next navigation sends the text typed meanwhile; a `q` it did not send (a link, back) is the route's.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import type { Href } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type Infer, ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { Box } from "@keel/ui";
import { expect, test } from "vitest";
import { TableSearch, columns, tableSearch } from "../src/index.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const Row = s.object({ id: s.string(), title: s.string() });
const cols = columns(Row, { key: "id", show: ["title"], search: ["title"] });
const Search = tableSearch(cols);
type Query = Infer<typeof Search>;
const st = contract("st", { "st.find": { path: "/st", search: Search } });
const hrefOf = (q: Query): Href => st.href("st.find", {}, q);
const queryOf = (raw: unknown): Query => {
  const r = Search.parse(raw);
  return r.ok ? r.value : {};
};

test("text typed while a search loads stays in the input and is sent next", async () => {
  const held: (() => void)[] = [];
  const sent: string[] = [];
  const routes = manifest(st, {
    "st.find": {
      loader: loader(st, "st.find", { output: s.object({}) }, async ({ search }) => {
        sent.push(String(search.q ?? ""));
        if (search.q !== undefined) await new Promise<void>((r) => held.push(r));
        return ok({});
      }),
      component: (props, ctx) =>
        Box({
          id: "st.page",
          children: () => [
            TableSearch(
              {
                id: "find",
                label: "Search",
                get search() {
                  return queryOf(props.search);
                },
                href: hrefOf,
              },
              ctx,
            ),
          ],
        }),
    },
  });
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const h = await renderRoute("st.find", { routes, params: {}, search: {}, ctx });
  await settle();
  await h.fire("find.input", { type: "focus" });
  await h.fire("find.input", { type: "input", value: "pie" });
  ctx.clock.advance(300);
  await settle();
  expect(sent).toEqual(["", "pie"]);
  // Typed while the "pie" load is held open; `fire` settles once that load ends.
  const typing = h.fire("find.input", { type: "input", value: "pies" });
  held.shift()?.();
  await typing;
  await settle();
  // The input is the same node: it keeps the focus it had before the load ended.
  expect(h.find("find.input").state.focused).toBe(true);
  ctx.clock.advance(300);
  await settle();
  expect(sent).toEqual(["", "pie", "pies"]);
  held.shift()?.();
  await settle();
  expect(h.route()).toMatchObject({ search: { q: "pies" } });
  // A q the input did not send is the route's.
  const going = h.navigate(hrefOf({ q: "tart" }));
  await settle();
  held.shift()?.();
  await going;
  await settle();
  expect(h.route()).toMatchObject({ search: { q: "tart" } });
  h.dispose();
});

// Known limit: a link built from the route's search before the input's navigation committed (a sort or pager link
// activated during a slow search load) re-applies the old `q`; the last navigation wins and the input shows it.
test.fails("a link activated while a search loads keeps the typed text (known limit)", async () => {
  const held: (() => void)[] = [];
  const routes = manifest(st, {
    "st.find": {
      loader: loader(st, "st.find", { output: s.object({}) }, async ({ search }) => {
        if (search.q !== undefined) await new Promise<void>((r) => held.push(r));
        return ok({});
      }),
      component: (props, ctx) =>
        TableSearch(
          {
            id: "find",
            label: "Search",
            get search() {
              return queryOf(props.search);
            },
            href: hrefOf,
          },
          ctx,
        ),
    },
  });
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const h = await renderRoute("st.find", { routes, params: {}, search: {}, ctx });
  await settle();
  await h.fire("find.input", { type: "input", value: "pie" });
  ctx.clock.advance(300);
  await settle();
  // A sort link minted from the old search (no `q`) is activated while the "pie" load is held.
  await h.navigate(hrefOf({}));
  held.shift()?.();
  await settle();
  try {
    expect(h.route()).toMatchObject({ search: { q: "pie" } });
  } finally {
    h.dispose();
  }
});
