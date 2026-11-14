// k.shell Shell ctx: a shell build's client entry creates `createCtx({ mode: 'shell', drivers })` from its std.shells
// package for `KEEL_ORIGIN`; the plain client entry is unchanged.
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

  it("leaves the plain entry a real ctx with no shell import", () => {
    const plain = entryCode(["/modules/c/routes.ts"], "virtual:keel.css");
    expect(plain).toContain('const ctx = createCtx({ mode: "real" });');
    expect(plain).not.toMatch(/std-(tauri|capacitor)|mode: "shell"/);
  });
});
