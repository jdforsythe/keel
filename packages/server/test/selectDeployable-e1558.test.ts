// @vitest-environment happy-dom
// createApp's E1558 (k.topology Rules): a `static` or `client` deployable refuses a route whose loader is live or names
// `stores`, or whose action names `stores`, naming the route and its module; a `node` deployable serves each.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { createApp, topology } from "../src/index.ts";

const view = () => document.createElement("main");
const routesWith = (kind: "loader" | "action" | "live") => {
  if (kind === "action") {
    const r = manifest({ "shop.cart": { path: "/cart", component: view } });
    r.actions({
      "shop.cart": { POST: action({ input: s.object({}), stores: () => ({}) }, () => Promise.resolve(ok(null))) },
    });
    return r;
  }
  const l =
    kind === "live"
      ? loader({ output: s.object({}) }, async function* () {
          yield ok({});
        })
      : loader({ output: s.object({}), stores: () => ({}) }, () => Promise.resolve(ok({})));
  return manifest({ "shop.cart": { path: "/cart", loader: l, component: view } });
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
