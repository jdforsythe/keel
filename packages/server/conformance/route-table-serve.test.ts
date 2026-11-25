// @vitest-environment happy-dom
// Spec: k.routes, clause "`createApp` serving `routeTable(a, b)` of two modules' manifests answers a route of each; `routeTable(routeTable(a), b)` and `routeTable(b, a)` answer every request alike, and `createApp({ routes: a })` as `routeTable(a)` does."
// Seed 1337 (fc.assert below).
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, boot, getHtml } from "./contract-support.ts";

const view = (name: string) => (): Node => {
  const e = document.createElement("main");
  e.setAttribute("data-page", name);
  return e;
};
const ac = contract("a", { "a.home": { path: "/a" } });
const bc = contract("b", { "b.home": { path: "/b" } });
const a = manifest(ac, { "a.home": { component: view("a") } });
const b = manifest(bc, { "b.home": { component: view("b") } });

const answer = async (routes: unknown, path: string) => {
  const app = await boot(routes, ["a", "b"]);
  const res = await app.fetch(getHtml(path));
  return { status: res.status, body: await res.text() };
};

describe("k.routes: a deployable serves a route table", () => {
  it("`createApp` serving `routeTable(a, b)` answers a route of each", async () => {
    const t = routeTable(a, b);
    expect((await answer(t, "/a")).body).toContain('data-page="a"');
    expect((await answer(t, "/b")).body).toContain('data-page="b"');
  });

  it("`routeTable(routeTable(a), b)` and `routeTable(b, a)` answer every request alike", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/a", "/b", "/c", "/a/x"), async (path) => {
        const base = await answer(routeTable(a, b), path);
        expect(await answer(routeTable(routeTable(a), b), path)).toEqual(base);
        expect(await answer(routeTable(b, a), path)).toEqual(base);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  it("`createApp({ routes: a })` answers as `routeTable(a)` does", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/a", "/b"), async (path) => {
        const app = await boot(a, ["a"]);
        const direct = await app.fetch(getHtml(path));
        const viaTable = await (await boot(routeTable(a), ["a"])).fetch(getHtml(path));
        expect(direct.status).toBe(viaTable.status);
        expect(await direct.text()).toBe(await viaTable.text());
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});
