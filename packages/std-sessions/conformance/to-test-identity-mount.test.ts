// @vitest-environment happy-dom
// Spec: std.sessions, clause "For a session of a `client` deployable's page in a fixture with `identity.ts` beside `topology.ts`, the `to-test` file imports `identity.ts`'s default export as `mount` and its `renderRoute` options hold `mount`, and `keel check` on it reports no E1730; in a fixture without `identity.ts` the file imports nothing from it and its options hold no `mount`."
// std.sessions, Commands "Otherwise they replay without `serve`, with `mount` the default export of the project's `identity.ts` when there is one, and the `to-test` file imports it as `mount` and passes it."
// Seed 1337 (the session's seed; no generated input). The fixture is fixtures/cart-bug (a `client` deployable `web`); the identity fixture rewrites its topology so `web` is served by a `node` deployable `api` holding a module `gate` (E1589 otherwise) and adds `identity.ts` and `identity.server.ts`.
// ASSUMPTIONS: the router-form file is `modules/cart/test/session-<fingerprint>.test.ts`; "its `renderRoute` options hold `mount`" is a `mount` key in the object literal of the one `renderRoute` call; `identity.ts` from there is `../../../identity.ts`.
import { fixedTime } from "@keel/tooling/test-time";
import fs from "node:fs";
import path from "node:path";
import { check } from "@keel/check";
import { run } from "@keel/cli";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { applyTo, buggySession, diskFixture, sessionFile } from "./fixtures.ts";

const IDENTITY_TOPOLOGY = `import { topology } from "@keel/server";

export default topology({
  web: { modules: ["cart"], adapter: "client", servedBy: "api" },
  api: { modules: ["gate"], adapter: "node" },
});
`;
const GATE_MODULE = `import { module } from "@keel/compiler";

export default module({ id: "gate", deps: [], capabilities: [], public: { exports: [] } });
`;
const IDENTITY = `import { identityMount } from "@keel/router";

export default identityMount("/api/auth");
`;
const IDENTITY_SERVER = `import { identity } from "@keel/server";
import mount from "./identity.ts";

export default identity({ identify: async () => "", handle: { path: mount.path, fn: () => new Response("") } });
`;
const ROUTER_EMITTED = /^modules\/cart\/test\/session-[0-9a-f]{12}\.test\.ts$/;

type Fx = ReturnType<typeof diskFixture>;

async function emit(fx: Fx): Promise<{ path: string; source: string; code: number }> {
  const written: string[] = [];
  const apply = applyTo(fx.dir);
  const r = await run(["session", "to-test", "sessions/failing.json"], {
    cwd: fx.dir,
    files: fx.files(),
    apply: (w) => {
      for (const x of w) if (x.content !== null) written.push(x.path);
      apply(w);
    },
  });
  const p = written.find((w) => ROUTER_EMITTED.test(w)) ?? "";
  return { path: p, source: p === "" ? "" : fs.readFileSync(path.join(fx.dir, p), "utf8"), code: r.code };
}
const optionsOf = (src: string): string => /renderRoute\(\s*"[^"]+",\s*(\{[\s\S]*?\})\s*\)/.exec(src)?.[1] ?? "";
const tsFiles = (fx: Fx) => fx.files().filter((f) => f.path.endsWith(".ts"));

describe("std.sessions: to-test of a client deployable's page in a project with identity.ts", () => {
  let fx: Fx;
  let out: Awaited<ReturnType<typeof emit>> = { path: "", source: "", code: -1 };
  afterAll(() => fx.dispose());
  beforeAll(async () => {
    fx = diskFixture();
    fx.write("topology.ts", IDENTITY_TOPOLOGY);
    fx.write("modules/gate/module.ts", GATE_MODULE);
    fx.write("identity.ts", IDENTITY);
    fx.write("identity.server.ts", IDENTITY_SERVER);
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx);
  }, fixedTime(120_000));

  test("the `to-test` file of a `client` deployable's page imports identity.ts's default export as `mount`", () => {
    expect(out.code).toBe(0);
    expect(out.path).toMatch(ROUTER_EMITTED);
    expect(out.source).toMatch(/import\s+mount\s+from\s+"\.\.\/\.\.\/\.\.\/identity\.ts"/);
  });

  test("its `renderRoute` options hold `mount`, and no `app`", () => {
    expect(optionsOf(out.source)).toMatch(/\bmount\b/);
    expect(optionsOf(out.source)).not.toMatch(/\bapp\b/);
  });

  test(
    "`keel check` on the `to-test` file reports no E1730",
    () => {
      const files = tsFiles(fx);
      expect(files.map((f) => f.path)).toContain(out.path);
      const diags = check(files, { root: fx.dir }).diagnostics;
      expect(diags.filter((d) => d.code === "E1730")).toEqual([]);
    },
    fixedTime(30_000),
  );

  test(
    "control: the same file with the `mount` import and key removed is one E1730 (the check is not vacuous)",
    () => {
      const stripped = out.source
        .replace(/^import\s+mount\s+from\s+"[^"]*identity\.ts";?\n/m, "")
        .replace(/,\s*mount\b(?!\s*from)/, "");
      expect(stripped).not.toBe(out.source);
      const rel = "modules/cart/test/stripped.test.ts";
      fx.write(rel, stripped);
      try {
        const diags = check(tsFiles(fx), { root: fx.dir }).diagnostics;
        expect(diags.filter((d) => d.code === "E1730" && d.path === rel)).toHaveLength(1);
      } finally {
        fs.rmSync(path.join(fx.dir, rel), { force: true });
      }
    },
    fixedTime(30_000),
  );
});

describe("std.sessions: to-test of a client deployable's page in a project without identity.ts", () => {
  let fx: Fx;
  let out: Awaited<ReturnType<typeof emit>> = { path: "", source: "", code: -1 };
  afterAll(() => fx.dispose());
  beforeAll(async () => {
    fx = diskFixture();
    fx.write("sessions/failing.json", sessionFile(await buggySession()));
    out = await emit(fx);
  }, fixedTime(120_000));

  test("in a fixture without identity.ts the `to-test` file imports nothing from it and its options hold no `mount`", () => {
    expect(out.code).toBe(0);
    expect(out.path).toMatch(ROUTER_EMITTED);
    expect(out.source).not.toContain("identity");
    expect(optionsOf(out.source)).not.toMatch(/\bmount\b/);
    expect(out.source).not.toMatch(/\bmount\b/);
  });
});
