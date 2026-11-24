import { Form, action, guard, loader, manifest, navigate, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
// Type-only fixture for the conformance files (in unsafe/ because it needs expected-error directives): checked by tsc,
// never run. Each case is one claim that a call "does not compile"; the run-time half of each sits in the named file of
// conformance/, which makes the same call untyped.
import { err, ok, s } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

const view = (): Node => document.createComment("");

export function conformanceNegativeTypes(): void {
  unsafe(
    "type-level negatives: each expected-error line asserts the router API rejects a misuse; checked by tsc, never run",
    () => {
      const Out = s.object({ n: s.int() });
      const Search = s.object({ q: s.string().optional() });
      const Denied = s.error("keel.denied", s.object({}));

      // binding-api-handlers.test.ts
      const bc = contract("a", {
        "a.home": { path: "/" },
        "a.box": { method: "GET", path: "/api/a", output: Out },
        "a.add": { method: "POST", path: "/api/a", body: Out, output: Out },
        "a.drop": { method: "DELETE", path: "/api/a/:id", params: s.object({ id: s.string() }), output: s.object({}) },
      });
      const box = loader(bc, "a.box", {}, async () => ok({ n: 1 }));
      const add = action(bc, "a.add", {}, () => ok({ n: 1 }));
      const drop = action(bc, "a.drop", {}, () => ok({}));
      manifest(bc, {
        "a.home": { component: view },
        // @ts-expect-error an API entry has no view
        "a.box": { loader: box, component: view },
        "a.add": { action: add },
        "a.drop": { action: drop },
      });
      manifest(bc, {
        "a.home": { component: view },
        // @ts-expect-error a GET entry takes `loader`
        "a.box": { action: add },
        "a.add": { action: add },
        "a.drop": { action: drop },
      });
      manifest(bc, {
        "a.home": { component: view },
        "a.box": { loader: box },
        // @ts-expect-error a write entry takes `action`
        "a.add": { loader: box },
        "a.drop": { action: drop },
      });
      const open = guard({}, async () => err(Denied.make({})));
      manifest(bc, {
        // @ts-expect-error a page guard needs a `redirect`
        "a.home": { component: view, guard: open },
        "a.box": { loader: box },
        "a.add": { action: add },
        "a.drop": { action: drop },
      });

      // contract-e1504-query.test.ts
      const qc = contract("a", { "a.x": { path: "/x" } });
      // @ts-expect-error GET is no action verb
      manifest(qc, { "a.x": { component: view, GET: () => null } });

      // contract-href.test.ts
      const OrderId = s.id("Order");
      const hc = contract("a", {
        "a.shell": { layout: true },
        "a.home": { path: "/" },
        "a.show": { path: "/o/:id", params: s.object({ id: OrderId }), search: Search },
        "a.list": { method: "GET", path: "/api/a", output: Out },
      });
      // @ts-expect-error a layout is no page
      hc.href("a.shell");
      // @ts-expect-error an API entry is no page
      hc.href("a.list");
      // @ts-expect-error `a.show` declares params
      hc.href("a.show");
      // @ts-expect-error `id` is a string, not an Order id
      hc.href("a.show", { id: 7 });
      const other = contract("b", { "b.home": { path: "/b" } });
      // @ts-expect-error `b.home` is no id of contract `a`
      hc.href("b.home");
      void other;

      // contract-kinds-e1510.test.ts
      // @ts-expect-error `search` is refused on an API entry
      contract("a", { "a.x": { method: "GET", path: "/x", output: Out, search: Search } });
      // @ts-expect-error a layout has no other member
      contract("a", { "a.x": { layout: true, path: "/x" } });
      // @ts-expect-error a page refuses `output`
      contract("a", { "a.x": { path: "/x", output: Out } });

      // contract-value.test.ts
      // @ts-expect-error a key is prefixed by the module id
      contract("a", { "a.home": { path: "/" }, "b.home": { path: "/b" } });

      // events-plain-loader-e1515.test.ts
      const ec = contract("a", {
        "a.ticks": { method: "GET", path: "/api/ticks", output: Out, events: true },
        "a.plain": { method: "GET", path: "/api/plain", output: Out },
      });
      const plainTicks = loader(ec, "a.ticks", {}, async () => ok({ n: 1 }));
      const plain = loader(ec, "a.plain", {}, async () => ok({ n: 1 }));
      // @ts-expect-error a plain loader on an `events: true` entry
      manifest(ec, { "a.ticks": { loader: plainTicks }, "a.plain": { loader: plain } });
      // @ts-expect-error a generator is no plain loader's `fn`
      loader(ec, "a.plain", {}, async function* () {
        yield ok({ n: 1 });
      });
      const pages = contract("p", { "p.shell": { layout: true }, "p.home": { path: "/" } });
      // @ts-expect-error a page loader is never live
      loader(pages, "p.home", { output: s.object({ title: s.string() }) }, async function* () {
        yield ok({ title: "t" });
      });

      // handler-names-entry.test.ts
      const View = s.object({ title: s.string() });
      const Edit = s.object({ note: s.string() });
      const k = contract("a", {
        "a.x": { path: "/x" },
        "a.y": { path: "/y" },
        "a.show": { path: "/o/:id", params: s.object({ id: OrderId }), search: Search },
        "a.api": {
          method: "GET",
          path: "/api/a/:id",
          params: s.object({ id: OrderId }),
          query: s.object({ q: s.string() }),
          output: Out,
        },
        "a.add": { method: "POST", path: "/api/a", body: Edit, output: Out },
      });
      const kOther = contract("b", { "b.x": { path: "/x" } });
      const loadApi = loader(k, "a.api", {}, async () => ok({ n: 1 }));
      const kAdd = action(k, "a.add", {}, () => ok({ n: 1 }));
      const forX = loader(k, "a.x", { output: View }, async () => ok({ title: "x" }));
      const rest = { "a.show": { component: view }, "a.api": { loader: loadApi }, "a.add": { action: kAdd } };
      // @ts-expect-error a loader declared for `a.x` is bound at `a.y`
      manifest(k, { "a.x": { component: view }, "a.y": { component: view, loader: forX }, ...rest });
      const foreign = loader(kOther, "b.x", { output: View }, async () => ok({ title: "b" }));
      manifest(k, {
        // @ts-expect-error `foreign` was declared for contract `b`
        "a.x": { component: view, loader: foreign },
        "a.y": { component: view },
        ...rest,
      });
      const pageAct = action(k, "a.x", { input: Edit }, () => ok(null));
      manifest(k, {
        "a.x": { component: view },
        "a.y": { component: view },
        "a.show": { component: view },
        "a.api": { loader: loadApi },
        // @ts-expect-error a page action bound at an API write entry
        "a.add": { action: pageAct },
      });
      // @ts-expect-error the answer is not the entry's `output`
      loader(k, "a.api", {}, async () => ok({ recipe: [] }));

      // layout-chain-binding.test.ts
      const lc = contract("a", {
        "a.outer": { layout: true },
        "a.inner": { layout: true },
        "a.page": { path: "/p" },
        "a.other": { path: "/o" },
      });
      manifest(lc, {
        "a.outer": { component: view },
        "a.inner": { component: view },
        "a.page": {
          component: view,
          // @ts-expect-error `a.other` is a page, not a layout
          layout: "a.other",
        },
        "a.other": { component: view },
      });
      manifest(lc, {
        "a.outer": { component: view },
        "a.inner": { component: view },
        "a.page": {
          component: view,
          // @ts-expect-error `a.nope` is no id of the contract
          layout: "a.nope",
        },
        "a.other": { component: view },
      });

      // layout-cross-module.test.ts, where-codes-table.test.ts
      const app = contract("app", { "app.page": { path: "/p" }, "app.other": { path: "/o" } });
      manifest(app, {
        // @ts-expect-error `app.frmae` is no layout of the contract
        "app.page": { component: view, layout: "app.frmae" },
        "app.other": { component: view },
      });

      // manifest-binding-e1515.test.ts
      const mc = contract("a", { "a.one": { path: "/one" }, "a.two": { path: "/two" } });
      // @ts-expect-error `a.two` is not bound
      manifest(mc, { "a.one": { component: view } });
      // @ts-expect-error `a.extra` is no entry of `c`
      manifest(mc, { "a.one": { component: view }, "a.two": { component: view }, "a.extra": { component: view } });
      const l = contract("l", { "l.shell": { layout: true }, "l.home": { path: "/" } });
      // @ts-expect-error a page is no layout of the contract
      manifest(l, { "l.shell": { component: view }, "l.home": { component: view, layout: "l.home" } });

      // route-table-union.test.ts
      // @ts-expect-error a contract is no route table
      routeTable(mc);

      // where-codes-table.test.ts
      // @ts-expect-error `b.home` is not prefixed by `a`
      contract("a", { "b.home": { path: "/" } });
      const wl = contract("a", { "a.l": { layout: true }, "a.p": { path: "/" } });
      // @ts-expect-error `a.zzz` is no layout of the contract
      manifest(wl, { "a.l": { component: view }, "a.p": { component: view, layout: "a.zzz" } });
      // @ts-expect-error a page entry takes no `output`
      contract("a", { "a.p": { path: "/", output: s.object({}) } });
      const wp = contract("a", { "a.p": { path: "/" } });
      // @ts-expect-error a page binding takes no `action`
      manifest(wp, { "a.p": { component: view, action: () => ok({}) } });
      // @ts-expect-error `a.two` is not bound
      manifest(mc, { "a.one": { component: view } });

      // navigate-not-href.test.ts, form-action-not-href.test.ts
      // @ts-expect-error a string is no `Href`
      navigate("/x");
      // @ts-expect-error a string is no `Href`
      Form({ method: "POST", action: "/x", children: () => [] });
    },
  );
}
