// k.shell Shell ctx: a shell build's client entry creates `createCtx({ mode: 'shell', drivers })` from its std.shells
// package for `KEEL_ORIGIN`; the plain client entry is unchanged. k.return: with the shell's id it also sets up the
// identity mount.
import { describe, expect, it } from "vitest";
import { entryCode } from "../src/internal/entryCode.ts";

describe("entryCode shell", () => {
  it("imports the shell's drivers and builds a shell ctx for the origin", () => {
    const tauri = entryCode(
      ["/modules/c/routes.ts"],
      "virtual:keel.css",
      {},
      {},
      {
        kind: "tauri",
        origin: "https://app.example",
      },
    );
    expect(tauri).toContain('import { tauriDrivers as __keelDrivers } from "@keel/std-tauri";');
    expect(tauri).toContain(
      'const ctx = createCtx({ mode: "shell", drivers: __keelDrivers({ origin: new URL("https://app.example") }) });',
    );
    const cap = entryCode(["/r.ts"], "c.css", {}, {}, { kind: "capacitor", origin: "http://localhost:8080" });
    expect(cap).toContain('import { capacitorDrivers as __keelDrivers } from "@keel/std-capacitor";');
  });

  it("with the shell's id (the project has identity.ts) imports identity.ts and calls shellMount with its mount before the router starts", () => {
    for (const [kind, pkg] of [
      ["tauri", "@keel/std-tauri"],
      ["capacitor", "@keel/std-capacitor"],
    ] as const) {
      const shell = { kind, origin: "https://app.example", id: "dev.keel.app" };
      const code = entryCode(["/r.ts"], "c.css", {}, {}, shell);
      expect(code).toContain(`import { shellMount as __keelMount } from "${pkg}/shellMount";`);
      expect(code).toContain('import __keelIdentity from "/identity.ts";');
      const call =
        '__keelMount(ctx, { id: "dev.keel.app", origin: new URL("https://app.example"), mount: __keelIdentity });';
      expect(code).toContain(call);
      expect(code.indexOf("const ctx =")).toBeLessThan(code.indexOf(call));
      expect(code.indexOf(call)).toBeLessThan(code.indexOf("createRouter("));
      const without = entryCode(["/r.ts"], "c.css", {}, {}, { kind, origin: "https://app.example" });
      expect(without).not.toMatch(/shellMount|identity/);
    }
  });

  it("leaves the plain entry a real ctx with no shell import", () => {
    const plain = entryCode(["/modules/c/routes.ts"], "virtual:keel.css");
    expect(plain).toContain('const ctx = createCtx({ mode: "real" });');
    expect(plain).not.toMatch(/std-(tauri|capacitor)|mode: "shell"/);
  });
});
