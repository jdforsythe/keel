// @vitest-environment happy-dom
// createApp's E1558 (k.topology Rules): a `static` or `client` deployable refuses a route whose loader is live or names
// `stores`, or whose action names `stores`, naming the route and its module; a `node` deployable serves each.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { createApp, topology } from "../src/index.ts";

const view = () => document.createElement("main");
const routesWith = (kind: "loader" | "action" | "live") => {
  if (kind === "action") {
    const c = contract("shop", { "shop.cart": { path: "/cart" } });
    const save = action(c, "shop.cart", { input: s.object({}), stores: () => ({}) }, () => Promise.resolve(ok(null)));
    return manifest(c, { "shop.cart": { component: view, POST: save } });
  }
  if (kind === "live") {
    const c = contract("shop", {
      "shop.cart": { method: "GET", path: "/api/cart", output: s.object({}), events: true },
    });
    const watch = loader(c, "shop.cart", {}, async function* () {
      yield ok({});
    });
    return manifest(c, { "shop.cart": { loader: watch } });
  }
  const c = contract("shop", { "shop.cart": { path: "/cart" } });
  const load = loader(c, "shop.cart", { output: s.object({}), stores: () => ({}) }, () => Promise.resolve(ok({})));
  return manifest(c, { "shop.cart": { loader: load, component: view } });
};
const outcome = (adapter: "client" | "static" | "node", kind: "loader" | "action" | "live"): Promise<string> =>
  createApp({
    topology: topology({ web: { modules: ["shop"], adapter } }),
    routes: routesWith(kind),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
  }).then(
    async (app) => {
      await app.close();
      return "built";
    },
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );

describe("createApp E1558", () => {
  const said = { loader: "loader names stores", action: "action names stores", live: "loader is live" } as const;
  for (const kind of ["loader", "action", "live"] as const) {
    test(`${kind}: refused by client and static, served by node`, async () => {
      for (const adapter of ["client", "static"] as const)
        expect(await outcome(adapter, kind)).toContain(
          `E1558 ${adapter} deployable web: route shop.cart ${said[kind]}; serve module shop from a node deployable`,
        );
      expect(await outcome("node", kind)).toBe("built");
    });
  }
});
