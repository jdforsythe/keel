// @vitest-environment happy-dom
// Spec: k.testing, clause "`navigate(c.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled." (rfc:0070)
// Seed 1337.
import { guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const p = (id: string, text: string): HTMLElement => {
  const e = document.createElement("p");
  e.id = id;
  e.textContent = text;
  return e;
};

const Params = s.object({ n: s.int() });
const ran: string[] = [];
const depth = { n: 0 };
const nvContract = contract("nv", {
  "nv.home": { path: "/nv" },
  "nv.shell": { layout: true },
  "nv.item": { path: "/nv/:n", params: Params },
});
const routes = manifest(nvContract, {
  "nv.home": { component: () => p("nv.home", "home") },
  "nv.shell": {
    component: (props) => {
      const main = document.createElement("main");
      main.id = "nv.shell";
      const data: unknown = props.data;
      main.append(p("nv.who", String(typeof data === "object" && data !== null ? Reflect.get(data, "who") : "")));
      if (props.children !== undefined) main.append(props.children());
      return main;
    },
    loader: loader(nvContract, "nv.shell", { output: s.object({ who: s.string() }) }, async () => {
      ran.push("shell.loader");
      await hops(depth.n);
      return ok({ who: "shell" });
    }),
  },
  "nv.item": {
    component: (props) => {
      const data: unknown = props.data;
      return p("nv.item", `item ${String(typeof data === "object" && data !== null ? Reflect.get(data, "n") : "")}`);
    },
    loader: loader(nvContract, "nv.item", { output: s.object({ n: s.int() }) }, async ({ params }) => {
      ran.push("item.loader");
      await hops(depth.n * 2);
      return ok({ n: params.n });
    }),
    guard: guard({ redirect: "nv.home" }, async () => {
      ran.push("item.guard");
      return ok(null);
    }),
    layout: "nv.shell",
  },
});

test("navigate runs the target's guards and loaders and resolves with its chain rendered and loaders settled", async () => {
  await fc.assert(
    fc.asyncProperty(fc.nat(30), fc.integer({ min: 0, max: 9 }), async (d, n) => {
      ran.length = 0;
      depth.n = d;
      const h = await renderRoute("nv.home", { routes, ctx: simCtx() });
      expect(h.find("nv.home").text).toBe("home");
      await h.navigate(nvContract.href("nv.item", { n }));
      expect(ran.slice(0, 1)).toEqual(["item.guard"]);
      expect([...ran].sort()).toEqual(["item.guard", "item.loader", "shell.loader"]);
      expect(h.route()).toEqual({ id: "nv.item", params: { n }, search: {}, pending: false });
      expect(h.find("nv.who").text).toBe("shell");
      expect(h.find("nv.item").text).toBe(`item ${n}`);
      h.dispose();
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("navigate back to a route without loaders renders it; after dispose navigate rejects with E1705", async () => {
  const h = await renderRoute("nv.item", { routes, params: { n: 1 }, ctx: simCtx() });
  await h.navigate(nvContract.href("nv.home"));
  expect(h.find("nv.home").text).toBe("home");
  h.dispose();
  await expect(h.navigate(nvContract.href("nv.home"))).rejects.toMatchObject({ code: "E1705" });
});
