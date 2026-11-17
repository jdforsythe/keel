// shellPlan (k.shell Build 1-2): the checks `keel build --target` runs before any work, in order, and the plan a clean
// project yields. Fake machines stand in for the toolchain. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { shellPlan } from "../src/shell/shellPlan.ts";
import type { Input } from "../src/types/Input.ts";
import type { Probe } from "../src/types/Probe.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const run = { seed: 1337, numRuns: 50 };

const topology = (shells: Record<string, string[]>): SourceFile => {
  const entries = Object.entries(shells).map(([name, kinds]) => {
    const body = kinds.map((k) => `${k}: { id: 'dev.keel.${name}', name: '${name}' }`).join(", ");
    return `  ${name}: { modules: ['c'], adapter: 'client'${kinds.length > 0 ? `, shells: { ${body} }` : ""} },`;
  });
  return {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({\n${entries.join("\n")}\n  api: { modules: ['c'], adapter: 'node' },\n})\n`,
  };
};
const pkg = (name: string): SourceFile => ({ path: "package.json", source: JSON.stringify({ name }) });

/** A machine with every tool a shell build needs. */
const full: Probe = {
  run: (cmd) => {
    if (cmd === "cargo") return { code: 0, out: "cargo 1.99.0 (abc 2026-01-01)" };
    if (cmd === "java") return { code: 0, out: 'openjdk version "21.0.2" 2024-01-16' };
    if (cmd === "xcodebuild") return { code: 0, out: "Xcode 26.1\nBuild version 17A1" };
    if (cmd === "pkg-config") return { code: 0, out: "2.41.0" };
    return undefined;
  },
  exists: () => true,
  platform: "darwin",
};
const goodEnv = { KEEL_ORIGIN: "https://app.example", ANDROID_HOME: "/sdk" };

describe("shellPlan", () => {
  test("shellPlan without a --target of capacitor or tauri has nothing to check and no plan", () => {
    for (const target of [undefined, "", "electron", "Tauri", "web"]) {
      const input: Input = target === undefined ? {} : { target };
      expect(shellPlan(input, [topology({ web: ["tauri"] })], goodEnv, "/app", full)).toEqual({
        diags: [],
        plan: undefined,
      });
    }
  });

  test("--platform goes with capacitor only: capacitor without it and tauri with it are E1052", () => {
    const project = [topology({ web: ["tauri", "capacitor"] })];
    const bare = shellPlan({ target: "capacitor" }, project, goodEnv, "/app", full);
    expect(bare.plan).toBeUndefined();
    expect(bare.diags).toHaveLength(1);
    expect(bare.diags[0]).toMatchObject({
      kind: "diag",
      code: "E1052",
      message: "--platform android|ios goes with --target capacitor only",
      see: "k.shell",
    });
    for (const platform of ["android", "ios"] as const) {
      const d = shellPlan({ target: "tauri", platform }, project, goodEnv, "/app", full);
      expect(d.plan).toBeUndefined();
      expect(d.diags.map((x) => x.code)).toEqual(["E1052"]);
    }
  });

  test("the platform check comes before the origin check", () => {
    const r = shellPlan({ target: "capacitor" }, [], {}, "/app", full);
    expect(r.diags.map((d) => d.code)).toEqual(["E1052"]);
  });

  test("a KEEL_ORIGIN that is absent or not https (http only on localhost) is E1574 that names the key, never the value", () => {
    const project = [topology({ web: ["tauri"] })];
    for (const origin of [undefined, "", "http://app.example", "ftp://app.example", "app.example"]) {
      const env = origin === undefined ? {} : { KEEL_ORIGIN: origin };
      const r = shellPlan({ target: "tauri" }, project, env, "/app", full);
      expect(r.plan).toBeUndefined();
      expect(r.diags).toHaveLength(1);
      expect(r.diags[0]).toMatchObject({
        code: "E1574",
        message: "KEEL_ORIGIN must be an https: origin (http: on localhost only)",
        see: "k.shell",
      });
      if (origin !== undefined && origin !== "") expect(JSON.stringify(r.diags)).not.toContain(origin);
    }
    const local = shellPlan({ target: "tauri" }, project, { KEEL_ORIGIN: "http://localhost:3000/x" }, "/app", full);
    expect(local.diags).toEqual([]);
    expect(local.plan?.origin).toBe("http://localhost:3000");
  });

  test("a topology with no client deployable declaring the shell is E1052 naming shells.<target>", () => {
    const only = [topology({ web: ["capacitor"] })];
    const r = shellPlan({ target: "tauri" }, only, goodEnv, "/app", full);
    expect(r.plan).toBeUndefined();
    expect(r.diags).toHaveLength(1);
    expect(r.diags[0]).toMatchObject({
      code: "E1052",
      message: "no client deployable in topology.ts declares shells.tauri",
      see: "k.shell",
    });
    const cap = shellPlan(
      { target: "capacitor", platform: "ios" },
      [topology({ web: ["tauri"] })],
      goodEnv,
      "/app",
      full,
    );
    expect(cap.diags[0]?.message).toBe("no client deployable in topology.ts declares shells.capacitor");
    // no topology.ts at all
    const none = shellPlan({ target: "tauri" }, [], goodEnv, "/app", full);
    expect(none.diags.map((d) => d.code)).toEqual(["E1052"]);
  });

  test("with no probe every tool is missing: the toolchain diagnostics come back and no plan", () => {
    const project = [topology({ web: ["tauri"] })];
    const r = shellPlan({ target: "tauri" }, project, goodEnv, "/app");
    expect(r.plan).toBeUndefined();
    expect(r.diags.length).toBeGreaterThan(0);
    for (const d of r.diags) expect(d).toMatchObject({ code: "E1575", see: "k.shell" });
    expect(r.diags[0]?.message).toContain("cargo");
  });

  test("a toolchain failure carries the toolchain's diagnostics and no plan", () => {
    const old: Probe = { ...full, run: (c, a) => (c === "cargo" ? { code: 0, out: "cargo 1.80.0" } : full.run(c, a)) };
    const r = shellPlan({ target: "tauri" }, [topology({ web: ["tauri"] })], goodEnv, "/app", old);
    expect(r.plan).toBeUndefined();
    expect(r.diags.map((d) => d.code)).toEqual(["E1575"]);
  });

  test("a clean tauri project yields the plan: shell, origin, sorted deployables, crate name, release false by default", () => {
    const project = [
      topology({ web: ["tauri"], desk: ["tauri"], site: [], mobile: ["capacitor"] }),
      pkg("@acme/My_App"),
    ];
    const r = shellPlan({ target: "tauri" }, project, goodEnv, "/app", full);
    expect(r.diags).toEqual([]);
    expect(r.plan).toEqual({
      target: "tauri",
      platform: undefined,
      release: false,
      origin: "https://app.example",
      deployables: ["desk", "web"],
      crate: "my_app",
    });
  });

  test("a clean capacitor project yields its platform; release is true only for release: true", () => {
    const project = [topology({ web: ["capacitor"] })];
    const env = { ...goodEnv, JAVA_HOME: "/jdk" };
    const probe: Probe = { ...full, run: (c, a) => (c === "/jdk/bin/java" ? full.run("java", a) : full.run(c, a)) };
    for (const platform of ["android", "ios"] as const) {
      for (const release of [true, false, undefined]) {
        const input: Input =
          release === undefined ? { target: "capacitor", platform } : { target: "capacitor", platform, release };
        const r = shellPlan(input, project, env, "/app", probe);
        expect(r.diags).toEqual([]);
        expect(r.plan?.target).toBe("capacitor");
        expect(r.plan?.platform).toBe(platform);
        expect(r.plan?.release).toBe(release === true);
        expect(r.plan?.crate).toBe("app");
      }
    }
  });

  test("property: the origin in the plan is the origin of https://<host> and the crate follows the package name", () => {
    const host = fc.stringMatching(/^[a-z]{1,8}\.(example|test)$/);
    const name = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);
    fc.assert(
      fc.property(host, name, fc.constantFrom("", "/x", "/a?b=1"), (h, n, rest) => {
        const r = shellPlan(
          { target: "tauri" },
          [topology({ web: ["tauri"] }), pkg(n)],
          { KEEL_ORIGIN: `https://${h}${rest}` },
          "/app",
          full,
        );
        expect(r.diags).toEqual([]);
        expect(r.plan?.origin).toBe(`https://${h}`);
        expect(r.plan?.crate).toBe(n);
      }),
      run,
    );
  });
});
