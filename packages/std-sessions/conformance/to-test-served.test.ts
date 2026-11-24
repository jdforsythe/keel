// @vitest-environment happy-dom
// Spec: std.sessions-served, Conformance "For a session whose `route.id` a `node` deployable `api` serves, the `to-test` file calls `createApp` with `deployable: "api"`, passes that result as `app` to `renderRoute` and passes no `state`; it is written to `test/session-<fingerprint>.test.ts` beside `topology.ts`; with an `identity.server.ts` in the fixture it imports it, and `keel check` on it reports no W1723 and no E1004; it fails under `keel test` on the buggy fixture and passes once the fix is applied. For a session of a `client` deployable's page the file passes `state` and no `app`."
// Spec: std.sessions, Conformance "A `to-test` file written without `--user` holds no `user` option; one written with `--user u1` holds `u1` once and no other user id."
// Spec: std.sessions, Commands "`to-test <f>` writes `modules/<route module>/test/session-<fingerprint>.test.ts`, or `test/session-<fingerprint>.test.ts` beside `topology.ts` for a page a `node` deployable serves: header `// Session: <fingerprint>, seed <n>`."
// Spec: std.sessions, Commands "For a `client` or `static` deployable it renders `renderRoute(<id>, { routes, params, search, state, ctx })`, `state` holding the recorded value of each store it can import."
// Spec: std.sessions-served, to-test "For a `node` deployable the file is `test/session-<fingerprint>.test.ts` in the project folder, where the project's hand-written `app` tests live: a file outside every module, so not client-reachable (k.boundary Reach), and it may import server-only files. It builds the app in the test body as `serve` does, after the clock advance and before `record`, importing `../topology.ts`, each placed module's routes (`../modules/<id>/routes.ts`, or its package's `./routes`; several joined with `routeTable` in `topology.ts` order), each nav's contract from `../modules/<id>/<id>.contract.ts`, and `../identity.server.ts` when there is one, and renders `renderRoute(<id>, { routes, params, search, ctx, app })`. It passes `app`, so `keel check` reports no W1723 on it (k.testing), and no `state`, so it holds no recorded store value."
// Spec: std.sessions, Commands "The `to-test` file is one straight-line test: a sim ctx of the session's seed (absent: 0), the clock advanced to `at`, `record(ctx)`, the base rendered with `user: <id>` in its options only when `--user` was given, each input applied in order (`fire` as `h.fire(id, event)`, `nav` as `h.navigate(<contract>.href(...))` with literal arguments, `net` as `ctx.net.setOnline(b)`), the clock advanced only where `at` changes, then `expect(rec.errors()).toEqual([])`."
// Spec: std.sessions-served, Served pages "The server's data comes only from the recorded inputs replayed through the app (a submit runs its action), never from `state`."
// Spec: std.sessions, k.boundary Reach "Client-reachable code (E1004 and E1571; E1107 has its own, k.leave), with a `topology.ts`: a file under `modules/<id>/`, not server-only, of a `node` or `static` module (one such a deployable lists); ..."
// Seed 1337
// The buggy fixture is `fixtures/cart-bug/` on a `node` deployable `api` (its `topology.ts` rewritten here) and, for the `client` twin, as it stands (deployable `web`). The existing `to-test.test.ts` and `to-test-redaction.test.ts` sit on the `client` deployable `web` (`fixtures/cart-bug/topology.ts`), so they keep the router form and stand.
// Each case group owns its fixture copy; the cases of one group read only what its `beforeAll` wrote, and a case that writes a file removes it in `finally`.
// Readings asserted: ids given to `--user` in the property start with a letter or digit (a leading `-` would read as a flag) and are at least 6 characters, so the id's single occurrence is not another word of the file.
// Reading asserted: the control for E1004 is the same imports written from a file under `modules/cart/test/` of the `node` module, which k.boundary Reach counts as client-reachable.
// Reading asserted: a `node` page's server data in a served session comes from an `add` click recorded as an input, so the marked session for the `app` form seeds nothing through `state`.
// Untestable here: several placed modules joined with `routeTable`, and a stdlib module's package `./routes` (the fixture places one app module).
import fs from "node:fs";
import path from "node:path";
import { check } from "@keel/check";
import { run } from "@keel/cli";
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { record } from "@keel/std-sessions";
import type { Session } from "@keel/std-sessions";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MARKERS, applyTo, buggyRoutes, buggySession, diskFixture, sessionFile } from "./fixtures.ts";
import { CartSearch } from "./fixtures/cart-bug/modules/cart/CartSearch.schema.ts";

const NODE_TOPOLOGY = `import { topology } from "@keel/server";

export default topology({ api: { modules: ["cart"], adapter: "node" } });
`;
const IDENTITY = `import { identity } from "@keel/server";

export default identity({ identify: async () => "" });
`;
const EMITTED = /^test\/session-[0-9a-f]{12}\.test\.ts$/;
const ROUTER_EMITTED = /^modules\/cart\/test\/session-[0-9a-f]{12}\.test\.ts$/;
const SERVER_IMPORTS_IDENTITY = `import { test } from "vitest";
import identity from "../../../identity.server.ts";

test("imports identity", () => {
  void identity;
});
`;

type Fx = ReturnType<typeof diskFixture>;

/** Runs `keel session to-test` over the session file and returns the emitted path, its text and the exit code. */
async function emit(
  fx: Fx,
  args: readonly string[] = [],
  pattern: RegExp = EMITTED,
): Promise<{ path: string; source: string; code: number; written: string[] }> {
  const written: string[] = [];
  const apply = applyTo(fx.dir);
  const r = await run(["session", "to-test", "sessions/failing.json", ...args], {
    cwd: fx.dir,
    files: fx.files(),
    apply: (w) => {
      for (const x of w) if (x.content !== null) written.push(x.path);
      apply(w);
    },
  });
  const p = written.find((w) => pattern.test(w)) ?? "";
  return { path: p, source: p === "" ? "" : fs.readFileSync(path.join(fx.dir, p), "utf8"), code: r.code, written };
}

const tsFiles = (fx: Fx) => fx.files().filter((f) => f.path.endsWith(".ts"));

/** A failing session of the buggy cart on a `node` page, whose items are recorded through an `add` click. */
async function servedMarkedSession(): Promise<Session> {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.clock.advance(1_794_262_903_390);
  const routes = buggyRoutes();
  const app = await createApp({
    topology: topology({ api: { modules: ["cart"], adapter: "node" } }),
    deployable: "api",
    routes,
    ctx,
  });
  const rec = record(ctx);
  const coupon = CartSearch.parse({ q: MARKERS.hidden.search, coupon: MARKERS.hidden.coupon });
  if (!coupon.ok) throw new Error("servedMarkedSession: search does not parse");
  const h = await renderRoute("cart.show", { routes, params: {}, search: coupon.value, ctx, app });
  await h.fire("cart.add", { type: "click" });
  await h.fire("cart.card", { type: "input", value: MARKERS.hidden.card });
  await h.fire("cart.card", { type: "input", value: "" });
  await h.fire("cart.pin", { type: "input", value: MARKERS.hidden.password });
  await h.fire("cart.checkout", { type: "click" }).catch(() => undefined);
  const session = rec.stop();
  h.dispose();
  return session;
}

describe("std.sessions: to-test of a node deployable's page", () => {
  let fx: Fx;
  afterAll(() => fx.dispose());
  let out: Awaited<ReturnType<typeof emit>> = { path: "", source: "", code: -1, written: [] };

  beforeAll(async () => {
    fx = diskFixture();
    fx.write("topology.ts", NODE_TOPOLOGY);
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx);
  }, 120_000);

  test('the `to-test` file of a `node` page calls `createApp` with `deployable: "api"`', () => {
    expect(out.code).toBe(0);
    expect(out.source).toMatch(/createApp\(\s*\{[^}]*deployable:\s*"api"/);
    expect(out.source).toContain("topology");
  });

  test("the `to-test` file of a `node` page is written to `test/session-<fingerprint>.test.ts` beside `topology.ts`, and under no module", () => {
    expect(out.path).toMatch(EMITTED);
    expect(fs.existsSync(path.join(fx.dir, "topology.ts"))).toBe(true);
    expect(out.written.filter((w) => w.startsWith("modules/") && w.includes("/test/session-"))).toEqual([]);
  });

  test("the `to-test` file passes that `createApp` result as `app` to `renderRoute`", () => {
    const m = /const (\w+) = await createApp\(/.exec(out.source);
    const name = m?.[1] ?? "";
    expect(name).not.toBe("");
    expect(out.source).toMatch(
      new RegExp(`renderRoute\\(\\s*"cart\\.show",\\s*\\{[^}]*\\bapp(?::\\s*${name})?\\b[^}]*\\}`),
    );
    expect(out.source).toMatch(/\{\s*routes,\s*params[^}]*\bctx\b[^}]*\bapp\b/);
  });

  test("the `to-test` file of a `node` page passes no `state` and holds no recorded store value", () => {
    expect(out.path).toMatch(EMITTED);
    expect(out.source).not.toMatch(/\bstate\b/);
    expect(out.source).not.toMatch(/\bitems\s*:/);
  });

  test("the `to-test` file builds the app after the clock advance and before `record`", () => {
    const advance = out.source.indexOf("clock.advance(");
    const app = out.source.indexOf("createApp(");
    const rec = out.source.indexOf("record(ctx)");
    expect(advance).toBeGreaterThanOrEqual(0);
    expect(app).toBeGreaterThan(advance);
    expect(rec).toBeGreaterThan(app);
  });

  test("the `to-test` file of a `node` page imports `../topology.ts`, `../modules/cart/routes.ts` and `../modules/cart/cart.contract.ts`, and no `identity.server.ts` when there is none", () => {
    expect(out.source).toMatch(/from\s+"\.\.\/topology\.ts"/);
    expect(out.source).toMatch(/from\s+"\.\.\/modules\/cart\/routes\.ts"/);
    expect(out.source).toMatch(/from\s+"\.\.\/modules\/cart\/cart\.contract\.ts"/);
    expect(out.source).not.toContain("identity.server");
  });

  test("`keel check` on the `to-test` file of a `node` page reports no W1723", () => {
    const files = tsFiles(fx);
    expect(files.map((f) => f.path)).toContain(out.path);
    const diags = check(files, { root: fx.dir }).diagnostics;
    expect(diags.filter((d) => d.code === "W1723" && d.path === out.path)).toEqual([]);
    expect(diags.filter((d) => d.code.startsWith("E") && d.path === out.path)).toEqual([]);
  }, 30_000);

  test("`keel check` reports W1723 on a hand-written router-mode `renderRoute` of the same page (the warning is not vacuous)", () => {
    const rel = "modules/cart/test/handwritten.test.ts";
    fx.write(
      rel,
      `import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { test } from "vitest";
import { routes } from "../routes.ts";

test("hand-written", async () => {
  const ctx = createCtx({ mode: "sim", seed: 0 });
  const h = await renderRoute("cart.show", { routes, params: {}, search: {}, ctx });
  h.dispose();
});
`,
    );
    try {
      const diags = check(tsFiles(fx), { root: fx.dir }).diagnostics;
      expect(diags.some((d) => d.code === "W1723" && d.path === rel)).toBe(true);
    } finally {
      fs.rmSync(path.join(fx.dir, rel), { force: true });
    }
  }, 30_000);

  test("the `to-test` file of a `node` page fails under `keel test` on the buggy fixture", async () => {
    expect(out.path).toMatch(EMITTED);
    const r = await run(["test", out.path], { cwd: fx.dir, files: fx.files() });
    expect(r.code).toBe(1);
  }, 120_000);

  test("the `to-test` file of a `node` page passes once the fix is applied", async () => {
    expect(out.path).toMatch(EMITTED);
    fx.fix();
    const r = await run(["test", out.path], { cwd: fx.dir, files: fx.files() });
    expect(r.code).toBe(0);
  }, 120_000);
});

describe("std.sessions: to-test of a node deployable's page with an identity.server.ts", () => {
  let fx: Fx;
  afterAll(() => fx.dispose());
  let out: Awaited<ReturnType<typeof emit>> = { path: "", source: "", code: -1, written: [] };

  beforeAll(async () => {
    fx = diskFixture();
    fx.write("topology.ts", NODE_TOPOLOGY);
    fx.write("identity.server.ts", IDENTITY);
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx);
  }, 120_000);

  test("with an `identity.server.ts` in the project, the `to-test` file imports `../identity.server.ts` and passes it to `createApp`", () => {
    expect(out.code).toBe(0);
    expect(out.path).toMatch(EMITTED);
    expect(out.source).toMatch(/from\s+"\.\.\/identity\.server\.ts"/);
    expect(out.source).toMatch(/createApp\(\s*\{[^}]*\bidentity\b/);
  });

  test("with an `identity.server.ts` in the fixture, `keel check` on the `to-test` file reports no W1723 and no E1004", () => {
    const files = tsFiles(fx);
    expect(files.map((f) => f.path)).toContain(out.path);
    const diags = check(files, { root: fx.dir }).diagnostics;
    expect(diags.filter((d) => d.code === "W1723" && d.path === out.path)).toEqual([]);
    expect(diags.filter((d) => d.code === "E1004" && d.path === out.path)).toEqual([]);
  }, 30_000);

  test("control: the same import of `identity.server.ts` from a file under `modules/cart/test/` of the `node` module is E1004 (the check is not vacuous)", () => {
    const rel = "modules/cart/test/imports-identity.test.ts";
    fx.write(rel, SERVER_IMPORTS_IDENTITY);
    try {
      const diags = check(tsFiles(fx), { root: fx.dir }).diagnostics;
      expect(diags.some((d) => d.code === "E1004" && d.path === rel)).toBe(true);
    } finally {
      fs.rmSync(path.join(fx.dir, rel), { force: true });
    }
  }, 30_000);
});

describe("std.sessions: to-test of a client deployable's page", () => {
  let fx: Fx;
  afterAll(() => fx.dispose());
  let out: Awaited<ReturnType<typeof emit>> = { path: "", source: "", code: -1, written: [] };

  beforeAll(async () => {
    fx = diskFixture();
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx, [], ROUTER_EMITTED);
  }, 120_000);

  test("for a session of a `client` deployable's page the `to-test` file passes `state` and no `app`", () => {
    expect(out.code).toBe(0);
    expect(out.path).toMatch(ROUTER_EMITTED);
    expect(out.source).toMatch(/renderRoute\(\s*"cart\.show",[^\n]*\bstate:/);
    expect(out.source).not.toMatch(/\bapp\b/);
    expect(out.source).not.toContain("createApp");
  });

  test("the `to-test` file of a `client` page is written under `modules/<route module>/test/`", () => {
    expect(out.written.filter((w) => EMITTED.test(w))).toEqual([]);
  });

  test("the `to-test` file of a `client` page holds no `user` option when `--user` is not given", () => {
    expect(out.source).not.toMatch(/\buser\s*:/);
  });
});

describe("std.sessions: the `user` option of a `to-test` file", () => {
  const userId = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_-]{5,40}$/);
  const cases: readonly { form: string; topology?: string; pattern: RegExp }[] = [
    { form: "node", topology: NODE_TOPOLOGY, pattern: EMITTED },
    { form: "client", pattern: ROUTER_EMITTED },
  ];

  for (const c of cases) {
    describe(`${c.form} form`, () => {
      let fx: Fx;
      afterAll(() => fx.dispose());
      beforeAll(async () => {
        fx = diskFixture();
        if (c.topology !== undefined) fx.write("topology.ts", c.topology);
        fx.write("sessions/failing.json", sessionFile(await buggySession()));
      }, 120_000);

      test("a `to-test` file written without `--user` holds no `user` option", async () => {
        const out = await emit(fx, [], c.pattern);
        expect(out.code).toBe(0);
        expect(out.path).not.toBe("");
        expect(out.source).not.toMatch(/\buser\s*:/);
      }, 120_000);

      test("a `to-test` file written with `--user <id>` holds that id exactly once and no other user id", async () => {
        await fc.assert(
          fc.asyncProperty(userId, async (id) => {
            const out = await emit(fx, ["--user", id], c.pattern);
            expect(out.code).toBe(0);
            const options = [...out.source.matchAll(/\buser\s*:\s*"([^"]*)"/g)].map((m) => m[1]);
            expect(options).toEqual([id]);
            expect(out.source.split(id)).toHaveLength(2);
            expect(out.source.match(/\buser\s*:/g)).toHaveLength(1);
          }),
          { seed: 1337, numRuns: 3 },
        );
      }, 300_000);

      test("a `to-test` file written with `--user u1` holds `u1` once and no other user id", async () => {
        const out = await emit(fx, ["--user", "u1"], c.pattern);
        expect([...out.source.matchAll(/\buser\s*:\s*"([^"]*)"/g)].map((m) => m[1])).toEqual(["u1"]);
        expect(out.source.match(/\buser\s*:/g)).toHaveLength(1);
      }, 120_000);
    });
  }
});

describe("std.sessions: a served `to-test` file holds no personal data past the recording's redaction", () => {
  let fx: Fx;
  beforeAll(() => {
    fx = diskFixture();
  });
  afterAll(() => fx.dispose());

  test("the `app` form holds no recorded `s.string()` value outside `expose` and no `s.secret` or password value, and no `--user` id when none was given", async () => {
    fx.write("topology.ts", NODE_TOPOLOGY);
    fx.write("sessions/failing.json", sessionFile(await servedMarkedSession()));
    const out = await emit(fx);
    expect(out.code).toBe(0);
    expect(out.source).toContain("createApp");
    for (const [name, marker] of Object.entries(MARKERS.hidden)) expect(out.source, name).not.toContain(marker);
    expect(out.source).not.toContain(MARKERS.exposed);
  }, 120_000);

  test("the `app` form with an `expose` entry in the module still passes no `state` and holds no recorded store value", async () => {
    fx.write(
      "modules/cart/module.ts",
      `import { module } from "@keel/compiler";

export default module({
  id: "cart",
  deps: ["@keel/std-sessions"],
  capabilities: [],
  public: { exports: [] },
  std: { "@keel/std-sessions": { expose: ["store:cart.cart#note"] } },
});
`,
    );
    fx.write("sessions/failing.json", sessionFile(await servedMarkedSession()));
    const out = await emit(fx);
    expect(out.code).toBe(0);
    expect(out.path).toMatch(EMITTED);
    expect(out.source).not.toMatch(/\bstate\b/);
    for (const marker of Object.values(MARKERS.hidden)) expect(out.source).not.toContain(marker);
  }, 120_000);
});
