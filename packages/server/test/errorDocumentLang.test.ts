// @vitest-environment happy-dom
// The language of the documents a matched route serves on failure (k.head): a guard's non-denial `err` and the 500
// fallback carry the route's prefix value; a 404 and a route without a prefix param carry `en`.
import { createCtx } from "@keel/ctx";
import { type RouteTable, guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Params = s.object({ locale: s.enum(["en-US", "de-DE"], { pathDefault: "en-US" }) });
const el = (tag: string): HTMLElement => document.createElement(tag);
const broken = guard({ redirect: "app.p" }, () => Promise.reject(new Error("boom")));
const appOf = (routes: RouteTable) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "compact", write: () => undefined },
  });
const langOf = async (app: Awaited<ReturnType<typeof appOf>>, path: string): Promise<[number, string]> => {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  const html = await res.text();
  return [res.status, /<html lang="([^"]*)"/.exec(html)?.[1] ?? ""];
};

describe("server failure document language", () => {
  it("a guard's non-denial err is served with the route's prefix value as lang", async () => {
    const c = contract("app", {
      "app.p": { path: "/:locale/p", params: Params },
      "app.g": { path: "/:locale/g", params: Params },
    });
    const app = await appOf(
      manifest(c, {
        "app.p": { component: () => el("main") },
        "app.g": { component: () => el("main"), guard: broken },
      }),
    );
    expect(await langOf(app, "/de-DE/g")).toEqual([500, "de-DE"]);
    expect(await langOf(app, "/g")).toEqual([500, "en-US"]);
  });

  it("the 500 fallback of a route that throws outside every boundary carries the route's prefix value", async () => {
    const c = contract("app", { "app.t": { path: "/:locale/t", params: Params } });
    const app = await appOf(
      manifest(c, {
        "app.t": {
          component: () => {
            throw new Error("boom");
          },
        },
      }),
    );
    const [status, lang] = await langOf(app, "/de-DE/t");
    expect(status).toBe(500);
    expect(lang).toBe("de-DE");
  });

  it("a 404 and a route without a prefix param carry en", async () => {
    const c = contract("app", {
      "app.p": { path: "/:locale/p", params: Params },
      "app.n": { path: "/n" },
      "app.h": { path: "/h" },
    });
    // A guard of a page without a prefix param redirects to a page without params (k.guards Carried params).
    const brokenPlain = guard({ redirect: "app.h" }, () => Promise.reject(new Error("boom")));
    const app = await appOf(
      manifest(c, {
        "app.p": { component: () => el("main") },
        "app.n": { component: () => el("main"), guard: brokenPlain },
        "app.h": { component: () => el("main") },
      }),
    );
    expect(await langOf(app, "/de-DE/zzz")).toEqual([404, "en"]);
    expect(await langOf(app, "/n")).toEqual([500, "en"]);
  });
});
