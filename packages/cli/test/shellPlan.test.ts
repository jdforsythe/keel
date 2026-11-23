// shellPlan (k.shell Build 1-3): the checks `keel build --target` runs before any work, in order, and the plan a clean
// project yields. A stub `ShellTarget` and fake machines stand in for the shell packages. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { shellTargets } from "../src/internal/shellTargets.ts";
import { shellPlan } from "../src/shell/shellPlan.ts";
import type { Input } from "../src/types/Input.ts";
import type { Probe } from "../src/types/Probe.ts";
import type { ShellTarget } from "../src/types/ShellTarget.ts";

const run = { seed: 1337, numRuns: 50 };
type Loaded = Awaited<ReturnType<typeof shellTargets>>;

const app = (deployable: string, pkg = "app") => ({
  deployable,
  id: `dev.keel.${deployable}`,
  name: deployable,
  version: "1.0.0",
  pkg,
  policy: undefined,
  identity: false,
});

/** A stub target: needs `node_modules/.bin/stub` in the project and, on `--platform b`, an `env.STUB_B`. */
const stub = (platforms: readonly string[]): ShellTarget => ({
  platforms,
  files: () => ({}),
  tools: (at) => [
    ...(at.probe.exists("node_modules/.bin/stub") ? [] : [{ tool: "stub", need: "stub in the app's devDependencies" }]),
    ...(at.platform === "b" && at.env.STUB_B === undefined ? [{ tool: "stub-b", need: "STUB_B set" }] : []),
  ],
  plugins: () => [],
  build: () => ({ error: "unused" }),
  ci: () => [],
});

const loaded = (over: Partial<Loaded> = {}): Loaded => ({
  targets: { tauri: stub([]), capacitor: stub(["a", "b"]) },
  shells: {},
  apps: [
    { shell: "tauri", app: app("web") },
    { shell: "tauri", app: app("desk") },
    { shell: "capacitor", app: app("mobile") },
  ],
  paths: new Set(),
  topology: {},
  needs: [],
  diags: [],
  ...over,
});

/** A machine with the stub tool present at the project's relative path. */
const full = (cwd: string): Probe => ({
  run: () => undefined,
  exists: (p) => p === `${cwd}/node_modules/.bin/stub`,
  platform: "darwin",
});
const goodEnv = { KEEL_ORIGIN: "https://app.example", STUB_B: "1" };

describe("shellPlan", () => {
  test("without a --target of capacitor or tauri there is nothing to check and no plan", () => {
    for (const target of [undefined, "", "electron", "Tauri", "web"]) {
      const input: Input = target === undefined ? {} : { target };
      expect(shellPlan(input, goodEnv, "/app", loaded(), full("/app"))).toEqual({ diags: [], plan: undefined });
    }
  });

  test("the shell targets' own diagnostics come back first and no plan", () => {
    const diag = { kind: "diag", code: "E1159", message: "x", see: "k.module" } as const;
    const r = shellPlan({ target: "tauri" }, goodEnv, "/app", loaded({ diags: [diag] }), full("/app"));
    expect(r).toEqual({ diags: [diag], plan: undefined });
  });

  test("--platform must be one of the target's platforms and is needed when it has some", () => {
    const bare = shellPlan({ target: "capacitor" }, goodEnv, "/app", loaded(), full("/app"));
    expect(bare.plan).toBeUndefined();
    expect(bare.diags).toHaveLength(1);
    expect(bare.diags[0]).toMatchObject({
      kind: "diag",
      code: "E1052",
      message: "--target capacitor needs --platform a|b",
      see: "k.shell",
    });
    const wrong = shellPlan({ target: "capacitor", platform: "ios" }, goodEnv, "/app", loaded(), full("/app"));
    expect(wrong.diags.map((x) => [x.code, x.message])).toEqual([["E1052", "--target capacitor needs --platform a|b"]]);
    const none = shellPlan({ target: "tauri", platform: "a" }, goodEnv, "/app", loaded(), full("/app"));
    expect(none.plan).toBeUndefined();
    expect(none.diags.map((x) => [x.code, x.message])).toEqual([["E1052", "--target tauri takes no --platform"]]);
  });

  test("the platform check comes before the origin check", () => {
    const r = shellPlan({ target: "capacitor" }, {}, "/app", loaded(), full("/app"));
    expect(r.diags.map((d) => d.code)).toEqual(["E1052"]);
  });

  test("a KEEL_ORIGIN that is absent or not https (http only on localhost) is E1574 that names the key, never the value", () => {
    for (const origin of [undefined, "", "http://app.example", "ftp://app.example", "app.example"]) {
      const env = origin === undefined ? {} : { KEEL_ORIGIN: origin };
      const r = shellPlan({ target: "tauri" }, env, "/app", loaded(), full("/app"));
      expect(r.plan).toBeUndefined();
      expect(r.diags).toHaveLength(1);
      expect(r.diags[0]).toMatchObject({
        code: "E1574",
        message: "KEEL_ORIGIN must be an https: origin (http: on localhost only)",
        see: "k.shell",
      });
      if (origin !== undefined && origin !== "") expect(JSON.stringify(r.diags)).not.toContain(origin);
    }
    const local = shellPlan(
      { target: "tauri" },
      { KEEL_ORIGIN: "http://localhost:3000/x" },
      "/app",
      loaded(),
      full("/app"),
    );
    expect(local.diags).toEqual([]);
    expect(local.plan?.origin).toBe("http://localhost:3000");
  });

  test("no client deployable declaring the shell, or no registered target, is E1052 naming shells.<target>", () => {
    const only = loaded({ apps: [{ shell: "capacitor", app: app("web") }] });
    const r = shellPlan({ target: "tauri" }, goodEnv, "/app", only, full("/app"));
    expect(r.plan).toBeUndefined();
    expect(r.diags).toHaveLength(1);
    expect(r.diags[0]).toMatchObject({
      code: "E1052",
      message: "no client deployable in topology.ts declares shells.tauri",
      see: "k.shell",
    });
    const noTarget = loaded({ targets: {} });
    const cap = shellPlan({ target: "capacitor", platform: "a" }, goodEnv, "/app", noTarget, full("/app"));
    expect(cap.diags[0]?.message).toBe("no client deployable in topology.ts declares shells.capacitor");
    const none = shellPlan({ target: "tauri" }, goodEnv, "/app", loaded({ apps: [], targets: {} }), full("/app"));
    expect(none.diags.map((d) => d.code)).toEqual(["E1052"]);
  });

  test("with no probe every tool is missing: one E1575 per entry and no plan", () => {
    const r = shellPlan(
      { target: "capacitor", platform: "b" },
      { KEEL_ORIGIN: "https://app.example" },
      "/app",
      loaded(),
    );
    expect(r.plan).toBeUndefined();
    expect(r.diags.map((d) => d.message)).toEqual([
      "stub missing or too old: needs stub in the app's devDependencies",
      "stub-b missing or too old: needs STUB_B set",
    ]);
    for (const d of r.diags) expect(d).toMatchObject({ code: "E1575", see: "k.shell" });
  });

  test("a relative path a target tests is read from the project folder; an absolute one is left as it is", () => {
    const seen: string[] = [];
    const target: ShellTarget = {
      ...stub([]),
      tools: (at) => {
        at.probe.exists("node_modules/.bin/stub");
        at.probe.exists("/abs/tool");
        return [];
      },
    };
    const probe: Probe = {
      run: () => undefined,
      exists: (p) => {
        seen.push(p);
        return true;
      },
      platform: "linux",
    };
    const r = shellPlan({ target: "tauri" }, goodEnv, "/app", loaded({ targets: { tauri: target } }), probe);
    expect(r.diags).toEqual([]);
    expect(seen).toEqual(["/app/node_modules/.bin/stub", "/abs/tool"]);
  });

  test("the target's tools are given --platform, the build's environment and the probe", () => {
    const given: unknown[] = [];
    const target: ShellTarget = {
      ...stub(["a"]),
      tools: (at) => {
        given.push(at.platform, at.env, at.probe.platform);
        return [];
      },
    };
    const l = loaded({ targets: { capacitor: target } });
    shellPlan({ target: "capacitor", platform: "a" }, goodEnv, "/app", l, full("/app"));
    expect(given).toEqual(["a", goodEnv, "darwin"]);
  });

  test("a clean tauri project yields the plan: shell, origin, the apps of the shell, release false by default", () => {
    const l = loaded();
    const r = shellPlan({ target: "tauri" }, goodEnv, "/app", l, full("/app"));
    expect(r.diags).toEqual([]);
    expect(r.plan).toEqual({
      target: "tauri",
      shell: l.targets.tauri,
      platform: undefined,
      release: false,
      origin: "https://app.example",
      apps: [app("web"), app("desk")],
      connect: { web: [], desk: [] },
    });
  });

  test("each app's connect is the build's peer origins then its declared origins, without KEEL_ORIGIN", () => {
    const topology = {
      web: { modules: [], adapter: "client" as const, origins: { connect: { "https://api.example": "r" } } },
      desk: {
        modules: [],
        adapter: "client" as const,
        origins: { connect: { "https://app.example": "r", "https://peer.example": "r", "https://b.example": "r" } },
      },
      api: { modules: [], adapter: "node" as const },
    };
    const env = { ...goodEnv, KEEL_PEER_API: "https://peer.example" };
    const r = shellPlan({ target: "tauri" }, env, "/app", loaded({ topology }), full("/app"));
    expect(r.plan?.connect).toEqual({
      web: ["https://peer.example", "https://api.example"],
      desk: ["https://peer.example", "https://b.example"],
    });
  });

  test("a plugin the target's apps lack is its E1572 beside the E1575 entries, the other shell's left out, and no plan", () => {
    const need = (shell: "tauri" | "capacitor", plugin: string) => ({
      shell,
      plugin,
      diag: { kind: "diag" as const, code: "E1572", message: `web: ${shell} needs ${plugin}` },
    });
    const l = loaded({ needs: [need("tauri", "@x/p"), need("capacitor", "@x/q")] });
    const r = shellPlan({ target: "tauri" }, goodEnv, "/app", l);
    expect(r.plan).toBeUndefined();
    expect(r.diags.map((d) => d.code)).toEqual(["E1575", "E1572"]);
    expect(r.diags[1]?.message).toBe("web: tauri needs @x/p");
    const clean = shellPlan({ target: "tauri" }, goodEnv, "/app", l, full("/app"));
    expect(clean.diags.map((d) => d.message)).toEqual(["web: tauri needs @x/p"]);
  });

  test("a clean capacitor project yields its platform; release is true only for release: true", () => {
    const l = loaded();
    for (const platform of ["a", "b"]) {
      for (const release of [true, false, undefined]) {
        const input: Input =
          release === undefined ? { target: "capacitor", platform } : { target: "capacitor", platform, release };
        const r = shellPlan(input, goodEnv, "/app", l, full("/app"));
        expect(r.diags).toEqual([]);
        expect(r.plan?.target).toBe("capacitor");
        expect(r.plan?.platform).toBe(platform);
        expect(r.plan?.release).toBe(release === true);
        expect(r.plan?.apps).toEqual([app("mobile")]);
      }
    }
  });

  test("property: the origin in the plan is the origin of https://<host>", () => {
    const host = fc.stringMatching(/^[a-z]{1,8}\.(example|test)$/);
    fc.assert(
      fc.property(host, fc.constantFrom("", "/x", "/a?b=1"), (h, rest) => {
        const r = shellPlan(
          { target: "tauri" },
          { KEEL_ORIGIN: `https://${h}${rest}` },
          "/app",
          loaded(),
          full("/app"),
        );
        expect(r.diags).toEqual([]);
        expect(r.plan?.origin).toBe(`https://${h}`);
      }),
      run,
    );
  });
});
