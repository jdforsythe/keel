import { describe, expect, it } from "vitest";
import { devEntryCode } from "../src/internal/devEntryCode.ts";

describe("keel dev storage (k.topology Local topology)", () => {
  it("gives each node deployable its own file storage under .keel-dev/", () => {
    const code = devEntryCode("/p", {
      web: { modules: ["w"], adapter: "client" },
      x: { modules: ["a"], adapter: "node" },
      y: { modules: ["b"], adapter: "node" },
    });
    expect(code).toContain('const { fileStorage } = await import("@keel/ctx/node");');
    expect(code).toContain(
      'createCtx({ mode: "real", drivers: { storage: fileStorage("/p/.keel-dev/x.storage.json") } })',
    );
    expect(code).toContain(
      'createCtx({ mode: "real", drivers: { storage: fileStorage("/p/.keel-dev/y.storage.json") } })',
    );
    expect(code).not.toContain(".keel-dev/web");
    expect(code).not.toContain('createCtx({ mode: "real" })');
  });
});
