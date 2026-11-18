// @vitest-environment happy-dom
// The language of the documents a matched route serves on failure (k.head): a guard's non-denial `err` and the 500
// fallback carry the route's prefix value; a 404 and a route without a prefix param carry `en`.
import { createCtx } from "@keel/ctx";
import { guard, manifest } from "@keel/router";
import type { RouteDef } from "@keel/router";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Params = s.object({ locale: s.enum(["en-US", "de-DE"], { pathDefault: "en-US" }) });
const el = (tag: string): HTMLElement => document.createElement(tag);
const broken = guard({ redirect: "app.p" }, () => Promise.reject(new Error("boom")));
const appOf = (defs: Record<string, RouteDef>) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(defs),
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
    const app = await appOf({
      "app.p": { path: "/:locale/p", params: Params, component: () => el("main") },
      "app.g": { path: "/:locale/g", params: Params, component: () => el("main"), guard: broken },
    });
    expect(await langOf(app, "/de-DE/g")).toEqual([500, "de-DE"]);
    expect(await langOf(app, "/g")).toEqual([500, "en-US"]);
  });

  it("the 500 fallback of a route that throws outside every boundary carries the route's prefix value", async () => {
    const app = await appOf({
      "app.t": {
        path: "/:locale/t",
        params: Params,
        component: () => {
          throw new Error("boom");
        },
      },
    });
    const [status, lang] = await langOf(app, "/de-DE/t");
    expect(status).toBe(500);
    expect(lang).toBe("de-DE");
  });

  it("a 404 and a route without a prefix param carry en", async () => {
    const app = await appOf({
      "app.p": { path: "/:locale/p", params: Params, component: () => el("main") },
      "app.n": { path: "/n", component: () => el("main"), guard: broken },
    });
    expect(await langOf(app, "/de-DE/zzz")).toEqual([404, "en"]);
    expect(await langOf(app, "/n")).toEqual([500, "en"]);
  });
});
