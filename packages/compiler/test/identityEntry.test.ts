// k.mount Navigation: a project with `identity.ts` starts its client router with `mount` the identity mount's path,
// so no page matches at or under it; without one the entry is unchanged. A shell build imports identity.ts once.
import { describe, expect, it } from "vitest";
import { entryCode } from "../src/internal/entryCode.ts";

const ROUTER = "createRouter(__keelRoutes0, { ctx, history: browserHistory(), mode, mount: __keelIdentity.path });";

describe("entryCode with identity.ts", () => {
  it("imports its default export and passes its path to the router as mount", () => {
    const code = entryCode(["/r.ts"], "c.css", {}, {}, undefined, "production", true);
    expect(code).toContain('import __keelIdentity from "/identity.ts";');
    expect(code).toContain(ROUTER);
    const plain = entryCode(["/r.ts"], "c.css");
    expect(plain).not.toContain("identity.ts");
    expect(plain).toContain("createRouter(__keelRoutes0, { ctx, history: browserHistory(), mode });");
  });

  it("in a shell build with the shell's id, imports identity.ts once, as the default import", () => {
    const shell = { kind: "tauri", origin: "https://app.example", id: "dev.keel.app" } as const;
    const code = entryCode(["/r.ts"], "c.css", {}, {}, shell, "production", true);
    expect(code.split('"/identity.ts"')).toHaveLength(2);
    expect(code).toContain('import __keelIdentity from "/identity.ts";');
    expect(code).toContain(ROUTER);
  });
});
