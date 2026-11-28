// E1579's file half (k.user Rules): only the project's own `identity.server.ts` is read.
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";

const e1579 = (path: string, source: string) =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1579");

describe("identityFile", () => {
  it("reads identity.server.ts at a project root, also in a workspace app, and not under modules/ or packages/", () => {
    const bad = "export default {}\n";
    expect(e1579("identity.server.ts", bad)).toHaveLength(1);
    expect(e1579("apps/web/identity.server.ts", bad)).toHaveLength(1);
    expect(e1579("modules/a/identity.server.ts", bad)).toEqual([]);
    expect(e1579("packages/x/src/identity.server.ts", bad)).toEqual([]);
    expect(e1579("identity.ts", bad)).toEqual([]);
  });

  it("reports at the file's start with the k.user reference", () => {
    const [d] = e1579("identity.server.ts", "export default identity({ identify, handle: { path: '/A', fn } })\n");
    expect(d).toMatchObject({ line: 1, col: 1, see: "k.user" });
    expect(d?.message).toContain("lowercase");
  });
});
