// k.topology Declaration, k.deploy Storage, k.shell Declaration: `storage` and `shells` read statically, and the
// production entry imports the std.db driver a `'sqlite'` or `'postgres'` deployable names.
import { rmSync } from "node:fs";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { parseTopology } from "../src/index.ts";
import { serverEntryCode } from "../src/internal/serverEntryCode.ts";

const root = tempDir("keel-entry-storage-");
afterAll(() => rmSync(root, { recursive: true, force: true }));
const top = (body: string) => parseTopology(`export default topology({ web: { modules: ['a'], ${body} } })\n`);

describe("storage and shells in topology.ts", () => {
  it("keeps a literal storage and each shell's id and name", () => {
    expect(top("adapter: 'node', storage: 'postgres'")).toEqual({
      topology: { web: { modules: ["a"], adapter: "node", storage: "postgres" } },
      problems: [],
    });
    expect(top("adapter: 'client', shells: { tauri: { id: 'dev.k.a', name: 'A' } }").topology.web?.shells).toEqual({
      tauri: { id: "dev.k.a", name: "A" },
    });
  });

  it("is a problem for a storage outside its literals or a shell it cannot read", () => {
    expect(top("adapter: 'node', storage: 'redis'").problems).toEqual([
      ["web", "web: storage is not 'file', 'sqlite' or 'postgres'"],
    ]);
    expect(top("adapter: 'client', shells: { electron: { id: 'a.b', name: 'A' } }").problems).toHaveLength(1);
    expect(top("adapter: 'client', shells: { tauri: { id: x, name: 'A' } }").problems).toHaveLength(1);
  });
});

describe("serverEntryCode storage", () => {
  it("passes open, which imports the named std.db driver only when called; 'file' imports none", () => {
    // The specifier is generated text, not an import of this file: it is assembled so the layering lint reads it so.
    const driver = ["@keel", "std-db", "sqlite"].join("/");
    const sqlite = serverEntryCode(root, "web", [], "sqlite");
    expect(sqlite).toContain(`const open = (url) => import("${driver}").then((m) => m.sqlite(url));`);
    expect(sqlite).not.toMatch(/await import\("@keel\/std-db/);
    expect(serverEntryCode(root, "web", [], "postgres")).toMatch(/runners: \{ {2}\}, open, dir:/);
    for (const code of [serverEntryCode(root, "web", []), serverEntryCode(root, "web", [], "file")]) {
      expect(code).not.toContain("std-db");
      expect(code).not.toContain(", open");
    }
  });
});
