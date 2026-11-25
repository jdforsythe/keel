import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";
import topology from "../topology.ts";
import { artifacts } from "./artifacts.ts";

const TILES = "https://tile.openstreetmap.org";

it("shows the tile from the declared origin", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  const app = await createApp({ topology, routes, ctx });
  const page = await renderRoute("app.home", { routes, params: {}, ctx, app, artifacts });
  // The tile is an image a screen reader names by its alt text, inside the page's main landmark.
  expect(page.find("app.home").role).toBe("main");
  expect(page.find("app.home.tile")).toMatchObject({ role: "img", name: "The whole world on one map tile" });
  expect(page.focusOrder()).toEqual([]);
  page.dispose();
});

it("widens img-src by the declared origin and nothing else", async () => {
  const web = await createApp({ topology, routes, ctx: createCtx({ mode: "sim", seed: 1 }) });
  const res = await web.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
  const policy = res.headers.get("content-security-policy") ?? "";
  expect(policy).toContain(`img-src 'self' ${TILES};`);
  expect(policy).toContain("connect-src 'self';");
  expect(policy).not.toContain("*");
});
