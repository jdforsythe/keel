// @vitest-environment happy-dom
// TableSearch keeps text typed while its navigation loads (the page is kept across a search-only navigation), and its
// next navigation sends that text; a `q` it did not send (a link, back) replaces the text.
import { createCtx } from "@keel/ctx";
import { createRouter, loader, manifest } from "@keel/router";
import type { Href, RouterHistory } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { type Infer, ok, s } from "@keel/schema";
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
const stub = (): Node => document.createComment("");
/** Same path and search as the route, used to mint `Href`s without the page reading its own manifest. */
const links = manifest({ "st.find": { path: "/st", search: Search, component: stub } });
const hrefOf = (q: Query): Href => links.href("st.find", {}, q);
const queryOf = (raw: unknown): Query => {
  const r = Search.parse(raw);
  return r.ok ? r.value : {};
};

const memory = (start: string): RouterHistory & { entries: string[] } => {
  const entries = [start];
  return {
    entries,
    push: (u) => {
      entries.push(u);
    },
    replace: (u) => {
      entries[entries.length - 1] = u;
    },
    current: () => entries[entries.length - 1] ?? start,
    onPop: () => undefined,
  };
};

test("text typed while a search loads stays in the input and is sent next", async () => {
  const held: (() => void)[] = [];
  const sent: string[] = [];
  const routes = manifest({
    "st.find": {
      path: "/st",
      search: Search,
      loader: loader({ output: s.object({}), search: Search }, async ({ search }) => {
        sent.push(String(search.q ?? ""));
        if (search.q !== undefined) await new Promise<void>((r) => held.push(r));
        return ok({});
      }),
      component: (props, _slots, ctx) =>
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
              undefined,
              ctx,
            ),
          ],
        }),
    },
  });
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const history = memory("/st");
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(router.App, host);
  await settle();
  const input = (): HTMLInputElement => {
    const el = document.getElementById("find.input");
    if (!(el instanceof HTMLInputElement)) throw new Error("no input");
    return el;
  };
  const type = (v: string): void => {
    input().value = v;
    input().dispatchEvent(new Event("input", { bubbles: true }));
  };
  const first = input();
  type("pie");
  ctx.clock.advance(300);
  await settle();
  expect(sent).toEqual(["", "pie"]);
  type("pies"); // while the "pie" load is held open
  held.shift()?.();
  await settle();
  expect(input()).toBe(first);
  expect(input().value).toBe("pies");
  ctx.clock.advance(300);
  await settle();
  expect(sent).toEqual(["", "pie", "pies"]);
  held.shift()?.();
  await settle();
  expect(history.entries).toEqual(["/st?q=pies"]);
  // A q the input did not send replaces its text.
  const going = router.navigate(hrefOf({ q: "tart" }));
  await settle();
  held.shift()?.();
  await going;
  await settle();
  expect(input().value).toBe("tart");
  off();
  router.dispose();
  host.remove();
});

// Known limit: a link built from the route's search before the input's navigation committed (a sort or pager link
// activated during a slow search load) re-applies the old `q`; the last navigation wins and the input shows it.
test.fails("a link activated while a search loads keeps the typed text (known limit)", async () => {
  const held: (() => void)[] = [];
  const routes = manifest({
    "st.find": {
      path: "/st",
      search: Search,
      loader: loader({ output: s.object({}), search: Search }, async ({ search }) => {
        if (search.q !== undefined) await new Promise<void>((r) => held.push(r));
        return ok({});
      }),
      component: (props, _slots, ctx) =>
        TableSearch(
          {
            id: "find",
            label: "Search",
            get search() {
              return queryOf(props.search);
            },
            href: hrefOf,
          },
          undefined,
          ctx,
        ),
    },
  });
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const router = createRouter(routes, { ctx, history: memory("/st") });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(router.App, host);
  await settle();
  const input = document.getElementById("find.input");
  if (!(input instanceof HTMLInputElement)) throw new Error("no input");
  input.value = "pie";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  ctx.clock.advance(300);
  await settle();
  // A sort link minted from the old search (no `q`) is activated while the "pie" load is held.
  await router.navigate(hrefOf({}));
  held.shift()?.();
  await settle();
  try {
    expect(input.value).toBe("pie");
  } finally {
    off();
    router.dispose();
    host.remove();
  }
});
