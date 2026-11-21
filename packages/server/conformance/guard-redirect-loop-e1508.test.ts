// @vitest-environment happy-dom
// Spec: k.guards, clause "A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`." Seed 1337.
// ASSUMPTIONS: route ids are `app.<name>`; a guard redirect target is a route id; the dev `diag` record is a JSON line
// with kind "diag" that mentions the code E1508; a static manifest() E1508 (self-redirect under own guard) is also accepted in the property.
import { createCtx } from "@keel/ctx";
import { guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp, get } from "./fixtures.ts";
import type { Mode } from "./fixtures.ts";

const Denied = s.error("keel.denied", s.object({}));
const Next = s.object({ next: s.string().optional() });
const deny = (to: string) => guard({ redirect: to }, () => Promise.resolve(err(Denied.make({}))));
const allow = (to: string) => guard({ redirect: to }, () => Promise.resolve(ok(null)));
const page = (name: string) => () => {
  const e = document.createElement("main");
  e.append(name);
  return e;
};
const shell = (p: { children?: () => Node | string }) => {
  const e = document.createElement("div");
  e.append(p.children?.() ?? "");
  return e;
};

type Def = Record<string, unknown>;
const fieldOf = (v: unknown, k: string): unknown =>
  typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
async function appOf(defs: Def, mode: Mode = "production", log?: { format: "json"; write(l: string): void }) {
  // The definitions are built at run time, so the contract and its binding are made through loosely typed calls.
  const decl = Object.fromEntries(
    Object.entries(defs).map(([id, d]) => [
      id,
      fieldOf(d, "path") === undefined ? { layout: true } : { path: fieldOf(d, "path"), search: fieldOf(d, "search") },
    ]),
  );
  const c: unknown = Reflect.apply(contract, undefined, ["app", decl]);
  const binding = Object.fromEntries(
    Object.entries(defs).map(([id, d]) => [
      id,
      Object.fromEntries(
        ["component", "guard", "layout"].flatMap((k) => (fieldOf(d, k) === undefined ? [] : [[k, fieldOf(d, k)]])),
      ),
    ]),
  );
  const routes = Reflect.apply(manifest, undefined, [c, binding]);
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    ...(log === undefined ? {} : { log }),
  });
}
const route = (n: string, extra: Def = {}) => ({ path: `/${n}`, search: Next, component: page(n), ...extra });
const loc = (r: Response) => r.headers.get("location");

// a chain of n redirects: r0 -> r1 -> ... -> rn, rn unguarded
function chain(n: number): Def {
  const d: Def = {};
  for (let i = 0; i <= n; i++) d[`app.r${i}`] = route(`r${i}`, i < n ? { guard: deny(`app.r${i + 1}`) } : {});
  return d;
}

describe("k.guards E1508 server", () => {
  it("a layout guard whose redirect target sits under it is 500 keel.unexpected, not 302 /login?next=%2Flogin, with no stack in production and a diag E1508 in dev", async () => {
    const defs: Def = {
      "app.shell": { component: shell, guard: deny("app.login") },
      "app.login": route("login", { layout: "app.shell" }),
    };
    const res = await (await appOf(defs)).fetch(get("/login"));
    expect(res.status).toBe(500);
    expect(loc(res)).toBeNull();
    expect(loc(res)).not.toBe("/login?next=%2Flogin");
    expect(await res.text()).not.toMatch(/\bat\s+\S+.*\(|\.tsx?:\d+|\.m?js:\d+|node_modules/);

    const lines: string[] = [];
    const dev = await appOf(defs, "dev", { format: "json", write: (l) => void lines.push(l) });
    const r2 = await dev.fetch(get("/login"));
    await r2.text();
    expect(r2.status).toBe(500);
    const diags = lines
      .map((l): unknown => JSON.parse(l))
      .filter((v) => typeof v === "object" && v !== null && "kind" in v && v.kind === "diag");
    expect(diags.some((v) => JSON.stringify(v).includes("E1508"))).toBe(true);
  });

  it("a two-route redirect cycle a -> b -> a is 500", async () => {
    const app = await appOf({
      "app.a": route("a", { guard: deny("app.b") }),
      "app.b": route("b", { guard: deny("app.a") }),
    });
    expect((await app.fetch(get("/a"))).status).toBe(500);
  });

  it("the ninth guard redirect in one request is 500; eight redirects end at 302 /r1?next=%2Fr0", async () => {
    const nine = await appOf(chain(9));
    expect((await nine.fetch(get("/r0"))).status).toBe(500);
    const eight = await appOf(chain(8));
    const res = await eight.fetch(get("/r0"));
    expect(res.status).toBe(302);
    expect(loc(res)).toBe("/r1?next=%2Fr0");
  });

  it("a redirect from a redirect route keeps the original next and never nests it", async () => {
    const app = await appOf({
      "app.a": route("a", { guard: deny("app.b") }),
      "app.b": route("b", { guard: deny("app.c") }),
      "app.c": route("c"),
    });
    const first = await app.fetch(get("/a"));
    expect(first.status).toBe(302);
    expect(loc(first)).toBe("/b?next=%2Fa");
    const second = await app.fetch(get("/b?next=%2Fa"));
    expect(second.status).toBe(302);
    expect(loc(second)).toBe("/c?next=%2Fa");
  });

  it("a guard that allows does not redirect (clean counterpart)", async () => {
    const app = await appOf({
      "app.a": route("a", { guard: allow("app.c") }),
      "app.c": route("c"),
    });
    expect((await app.fetch(get("/a"))).status).toBe(200);
    expect((await app.fetch(get("/c"))).status).toBe(200);
  });

  it("for arbitrary guard graphs every request resolves to 200, 302 or 500, no Location nests next, and following Locations ends within 9 requests", async () => {
    const graph = fc
      .integer({ min: 1, max: 6 })
      .chain((n) =>
        fc.array(fc.option(fc.integer({ min: 0, max: n - 1 }), { nil: undefined }), { minLength: n, maxLength: n }),
      );
    // seed 1337
    await fc.assert(
      fc.asyncProperty(graph, async (edges) => {
        const defs: Def = {};
        edges.forEach((to, i) => {
          defs[`app.r${i}`] = route(`r${i}`, to === undefined ? {} : { guard: deny(`app.r${to}`) });
        });
        let app;
        try {
          app = await appOf(defs);
        } catch (e) {
          // static E1508: a guard's literal redirect route is under that guard
          expect(String(e)).toContain("E1508");
          return;
        }
        for (let i = 0; i < edges.length; i++) {
          let url = `/r${i}`;
          let hops = 0;
          for (;;) {
            const res = await app.fetch(get(url));
            await res.text();
            expect([200, 302, 500]).toContain(res.status);
            if (res.status !== 302) break;
            const l = loc(res) ?? "";
            const u = new URL(l, "http://localhost");
            const next = u.searchParams.get("next") ?? "";
            expect(next.includes("next=")).toBe(false);
            url = l;
            hops++;
            expect(hops).toBeLessThanOrEqual(9);
          }
        }
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
