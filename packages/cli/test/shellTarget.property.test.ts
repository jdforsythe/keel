// `keel build --target` before any work: the KEEL_ORIGIN rule, the toolchain against fake machines, the Capacitor meta policy.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { metaPolicy } from "../src/shell/metaPolicy.ts";
import { shellOrigin } from "../src/shell/shellOrigin.ts";
import { toolchain } from "../src/shell/toolchain.ts";
import type { Probe } from "../src/types/Probe.ts";

const run = { seed: 1337, numRuns: 200 };
const host = fc.stringMatching(/^[a-z]{1,8}\.(example|test)$/);
const port = fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined });
const withPort = (h: string, p: number | undefined) => (p === undefined ? h : `${h}:${p}`);

/** A machine with the given tools (command -> output) and paths. */
const machine = (tools: Record<string, string>, paths: readonly string[], platform: string): Probe => ({
  run: (cmd) => (cmd in tools ? { code: 0, out: tools[cmd] ?? "" } : undefined),
  exists: (p) => paths.includes(p),
  platform,
});
const bins = ["/app/node_modules/.bin/tauri", "/app/node_modules/.bin/cap"];
const codes = (ds: readonly { code: string; message: string }[]) => ds.map((d) => d.code);

describe("shellOrigin", () => {
  test("https: anywhere and http: on localhost are kept as the origin; anything else is refused", () => {
    fc.assert(
      fc.property(host, port, fc.constantFrom("", "/x", "/a/b?q=1"), (h, p, rest) => {
        expect(shellOrigin(`https://${withPort(h, p)}${rest}`)).toBe(new URL(`https://${withPort(h, p)}`).origin);
        expect(shellOrigin(`http://${withPort("localhost", p)}${rest}`)).toBe(
          new URL(`http://${withPort("localhost", p)}`).origin,
        );
        for (const bad of [`http://${withPort(h, p)}${rest}`, `ftp://${h}`, h, "", `capacitor://${h}`])
          expect(shellOrigin(bad), bad).toBeUndefined();
      }),
      run,
    );
    expect(shellOrigin(undefined)).toBeUndefined();
  });
});

describe("toolchain", () => {
  test("cargo at Rust 1.95 or newer passes; older or missing is one E1575 naming cargo and 1.95", () => {
    fc.assert(
      fc.property(fc.integer({ min: 80, max: 120 }), fc.integer({ min: 0, max: 9 }), (minor, patch) => {
        const ok = machine({ cargo: `cargo 1.${minor}.${patch} (abc 2026-01-01)` }, bins, "darwin");
        const ds = toolchain("tauri", undefined, ok, {}, "/app");
        if (minor >= 95) expect(ds).toEqual([]);
        else {
          expect(codes(ds)).toEqual(["E1575"]);
          expect(ds[0]?.message).toContain("cargo");
          expect(ds[0]?.message).toContain("1.95");
        }
      }),
      run,
    );
    const none = toolchain("tauri", undefined, machine({}, [], "linux"), {}, "/app");
    expect(none.map((d) => d.message.split(" ")[0])).toEqual(["cargo", "webkit2gtk-4.1", "tauri"]);
  });

  test("cargo under CARGO_HOME is found when PATH has none", () => {
    const p: Probe = {
      run: (cmd) => (cmd === "/h/.cargo/bin/cargo" ? { code: 0, out: "cargo 1.99.1" } : undefined),
      exists: (x) => x === "/h/.cargo/bin/cargo" || bins.includes(x),
      platform: "darwin",
    };
    expect(toolchain("tauri", undefined, p, { HOME: "/h" }, "/app")).toEqual([]);
  });

  test("Android needs JDK 21 and an SDK; iOS needs macOS and Xcode 26", () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 25 }), fc.integer({ min: 15, max: 30 }), (jdk, xcode) => {
        const java = jdk === 8 ? 'openjdk version "1.8.0_402"' : `openjdk version "${jdk}.0.2" 2024-01-16`;
        const android = machine({ "/jdk/bin/java": java }, [...bins, "/sdk/platform-tools"], "linux");
        const a = toolchain("capacitor", "android", android, { JAVA_HOME: "/jdk", ANDROID_HOME: "/sdk" }, "/app");
        expect(codes(a)).toEqual(jdk >= 21 ? [] : ["E1575"]);
        const ios = machine({ xcodebuild: `Xcode ${xcode}.6\nBuild version 17A1` }, bins, "darwin");
        expect(codes(toolchain("capacitor", "ios", ios, {}, "/app"))).toEqual(xcode >= 26 ? [] : ["E1575"]);
      }),
      run,
    );
    const linuxIos = toolchain("capacitor", "ios", machine({ xcodebuild: "Xcode 26.6" }, bins, "linux"), {}, "/app");
    expect(linuxIos[0]?.message).toContain("macOS");
    const noSdk = toolchain("capacitor", "android", machine({ java: 'version "21"' }, bins, "linux"), {}, "/app");
    expect(noSdk.map((d) => d.message)).toEqual([
      "Android SDK not found: set ANDROID_HOME to an SDK with platform-tools",
    ]);
  });
});

describe("metaPolicy", () => {
  test("the meta tag is first in head and drops the directives a meta tag ignores", () => {
    const policy =
      "default-src 'none'; script-src 'self'; connect-src 'self' https://api.example; frame-ancestors 'none'; report-uri /r; sandbox";
    const html = metaPolicy('<!doctype html><html><head lang="en"><title>x</title></head></html>', policy);
    expect(html).toContain(
      `<head lang="en">\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; connect-src 'self' https://api.example">`,
    );
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<title>"));
    expect(html).not.toContain("frame-ancestors");
  });
});
