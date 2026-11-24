// @vitest-environment happy-dom
// Spec: std.sessions, clause "For a session whose `route.id` a `node` deployable `api` serves, the `to-test` file calls `createApp` with `deployable: "api"`, passes that result as `app` to `renderRoute` and passes no `state`; `keel check` on it reports no W1723; it fails under `keel test` on the buggy fixture and passes once the fix is applied. For a session of a `client` deployable's page the file passes `state` and no `app`."
// Spec: std.sessions, clause "A `to-test` file written without `--user` holds no `user` option; one written with `--user u1` holds `u1` once and no other user id."
// Spec: std.sessions, Commands "For a `node` deployable it builds the app in the test body as `serve` does, after the clock advance and before `record`, importing `topology.ts`, each placed module's routes (`modules/<id>/routes.ts`, or its package's `./routes`; several joined with `routeTable` in `topology.ts` order) and `identity.server.ts` when there is one, and renders `renderRoute(<id>, { routes, params, search, ctx, app })`. It passes no `state` and holds no recorded store value, so `keel check` reports no W1723 on it (k.testing)."
// Spec: std.sessions, Commands "For a `client` or `static` deployable it renders `renderRoute(<id>, { routes, params, search, state, ctx })`, `state` holding the recorded value of each store it can import."
// Spec: std.sessions, Commands "The `to-test` file is one straight-line test: a sim ctx of the session's seed (absent: 0), the clock advanced to `at`, `record(ctx)`, the base rendered with `user: <id>` in its options only when `--user` was given, each input applied in order (`fire` as `h.fire(id, event)`, `nav` as `h.navigate(<contract>.href(...))` with literal arguments, `net` as `ctx.net.setOnline(b)`), the clock advanced only where `at` changes, then `expect(rec.errors()).toEqual([])`."
// Seed 1337
// The buggy fixture is `fixtures/cart-bug/` on a `node` deployable `api` (its `topology.ts` rewritten here) and, for the `client` twin, as it stands (deployable `web`). The existing `to-test.test.ts` and `to-test-redaction.test.ts` sit on the `client` deployable `web` (`fixtures/cart-bug/topology.ts`), so they keep the router form and stand.
// Readings asserted: ids given to `--user` in the property start with a letter or digit (a leading `-` would read as a flag) and are at least 6 characters, so the id's single occurrence is not another word of the file.
// Untestable here: several placed modules joined with `routeTable`, and a stdlib module's package `./routes` (the fixture places one app module).
import fs from "node:fs";
import path from "node:path";
import { check } from "@keel/check";
import { run } from "@keel/cli";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { MARKERS, applyTo, buggySession, diskFixture, markedSession, sessionFile } from "./fixtures.ts";

const NODE_TOPOLOGY = `import { topology } from "@keel/server";

export default topology({ api: { modules: ["cart"], adapter: "node" } });
`;
const IDENTITY = `import { identity } from "@keel/server";

export default identity({ identify: async () => "" });
`;
const EMITTED = /^modules\/cart\/test\/session-[0-9a-f]{12}\.test\.ts$/;

type Fx = ReturnType<typeof diskFixture>;

/** Runs `keel session to-test` over the session file and returns the emitted path, its text and the exit code. */
async function emit(fx: Fx, args: readonly string[] = []): Promise<{ path: string; source: string; code: number }> {
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
  const p = written.find((w) => EMITTED.test(w)) ?? "";
  return { path: p, source: p === "" ? "" : fs.readFileSync(path.join(fx.dir, p), "utf8"), code: r.code };
}

describe("std.sessions: to-test of a node deployable's page", () => {
  let fx: Fx;
  afterAll(() => fx.dispose());
  let out = { path: "", source: "", code: -1 };

  beforeAll(async () => {
    fx = diskFixture();
    fx.write("topology.ts", NODE_TOPOLOGY);
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx);
  }, 120_000);

  test('the `to-test` file of a `node` page calls `createApp` with `deployable: "api"`', () => {
    expect(out.code).toBe(0);
    expect(out.path).toMatch(EMITTED);
    expect(out.source).toMatch(/createApp\(\s*\{[^}]*deployable:\s*"api"/);
    expect(out.source).toContain("topology");
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

  test("the `to-test` file of a `node` page imports `topology.ts` and the placed module's `routes.ts`", () => {
    expect(out.source).toMatch(/from\s+"[^"]*topology\.ts"/);
    expect(out.source).toMatch(/from\s+"[^"]*modules\/cart\/routes\.ts"|from\s+"\.\.\/routes\.ts"/);
    expect(out.source).not.toContain("identity.server");
  });

  test("with an `identity.server.ts` in the project, the `to-test` file imports it", async () => {
    fx.write("identity.server.ts", IDENTITY);
    const withIdentity = await emit(fx);
    fs.rmSync(path.join(fx.dir, "identity.server.ts"));
    expect(withIdentity.source).toContain("identity.server");
    expect(withIdentity.source).toMatch(/createApp\(\s*\{[^}]*\bidentity\b/);
  }, 120_000);

  test("`keel check` on the `to-test` file of a `node` page reports no W1723", () => {
    const files = fx.files().filter((f) => f.path.endsWith(".ts"));
    expect(files.map((f) => f.path)).toContain(out.path);
    const diags = check(files, { root: fx.dir }).diagnostics;
    expect(diags.filter((d) => d.code === "W1723" && d.path === out.path)).toEqual([]);
    expect(diags.filter((d) => d.code.startsWith("E") && d.path === out.path)).toEqual([]);
  });

  test("`keel check` reports W1723 on a hand-written router-mode `renderRoute` of the same page (the warning is not vacuous)", () => {
    fx.write(
      "modules/cart/test/handwritten.test.ts",
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
    const files = fx.files().filter((f) => f.path.endsWith(".ts"));
    const diags = check(files, { root: fx.dir }).diagnostics;
    expect(diags.some((d) => d.code === "W1723" && d.path === "modules/cart/test/handwritten.test.ts")).toBe(true);
    fs.rmSync(path.join(fx.dir, "modules/cart/test/handwritten.test.ts"));
  });

  test("the `to-test` file of a `node` page fails under `keel test` on the buggy fixture", async () => {
    const r = await run(["test", out.path], { cwd: fx.dir, files: fx.files() });
    expect(r.code).toBe(1);
  }, 120_000);

  test("the `to-test` file of a `node` page passes once the fix is applied", async () => {
    fx.fix();
    const r = await run(["test", out.path], { cwd: fx.dir, files: fx.files() });
    expect(r.code).toBe(0);
  }, 120_000);
});

describe("std.sessions: to-test of a client deployable's page", () => {
  let fx: Fx;
  afterAll(() => fx.dispose());
  let out = { path: "", source: "", code: -1 };

  beforeAll(async () => {
    fx = diskFixture();
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx);
  }, 120_000);

  test("for a session of a `client` deployable's page the `to-test` file passes `state` and no `app`", () => {
    expect(out.code).toBe(0);
    expect(out.source).toMatch(/renderRoute\(\s*"cart\.show",[^\n]*\bstate:/);
    expect(out.source).not.toMatch(/\bapp\b/);
    expect(out.source).not.toContain("createApp");
  });

  test("the `to-test` file of a `client` page holds no `user` option when `--user` is not given", () => {
    expect(out.source).not.toMatch(/\buser\s*:/);
  });
});

describe("std.sessions: the `user` option of a `to-test` file", () => {
  const userId = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_-]{5,40}$/);
  const cases: readonly { form: string; topology?: string }[] = [
    { form: "node", topology: NODE_TOPOLOGY },
    { form: "client" },
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
        const out = await emit(fx);
        expect(out.code).toBe(0);
        expect(out.source).not.toMatch(/\buser\s*:/);
      }, 120_000);

      test("a `to-test` file written with `--user <id>` holds that id exactly once and no other user id", async () => {
        await fc.assert(
          fc.asyncProperty(userId, async (id) => {
            const out = await emit(fx, ["--user", id]);
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
        const out = await emit(fx, ["--user", "u1"]);
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
    fx.write("sessions/failing.json", sessionFile(await markedSession()));
    const out = await emit(fx);
    expect(out.code).toBe(0);
    expect(out.source).toContain("createApp");
    for (const [name, marker] of Object.entries(MARKERS.hidden)) expect(out.source, name).not.toContain(marker);
    expect(out.source).not.toContain(MARKERS.exposed);
  }, 120_000);

  test("the `app` form holds the value an `expose` entry names only through the router form's `state`, which it does not pass", async () => {
    // The `app` form passes no `state` and holds no recorded store value, so an exposed note is not written either.
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
    fx.write("sessions/failing.json", sessionFile(await markedSession()));
    const out = await emit(fx);
    expect(out.source).not.toContain(MARKERS.exposed);
    for (const marker of Object.values(MARKERS.hidden)) expect(out.source).not.toContain(marker);
  }, 120_000);
});
