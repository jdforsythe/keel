// TopologySchema (k.topology): the shape `topology()` parses a definition with. Each case loads a fresh copy of the
// module so its tables are built inside the case.
import { describe, expect, it, vi } from "vitest";

async function accepts(value: unknown): Promise<boolean> {
  vi.resetModules();
  const { TopologySchema } = await import("../src/internal/TopologySchema.ts");
  return TopologySchema.parse(value).ok;
}
const node = { modules: ["a"], adapter: "node" };

describe("TopologySchema", () => {
  it("accepts a record of deployables, empty included, each with modules and an adapter", async () => {
    expect(await accepts({})).toBe(true);
    expect(await accepts({ web: node })).toBe(true);
    expect(await accepts({ web: node, api: { modules: [], adapter: "static" } })).toBe(true);
    expect(await accepts({ c: { modules: ["x", "y"], adapter: "client" } })).toBe(true);
  });

  it("refuses a value that is not a record of objects", async () => {
    for (const v of [null, undefined, 7, "x", [], { web: null }, { web: 7 }, { web: "node" }, { web: [] }])
      expect(await accepts(v), JSON.stringify(v)).toBe(false);
  });

  it("needs modules, an array of non-empty strings", async () => {
    expect(await accepts({ web: { adapter: "node" } })).toBe(false);
    expect(await accepts({ web: { modules: "a", adapter: "node" } })).toBe(false);
    expect(await accepts({ web: { modules: [""], adapter: "node" } })).toBe(false);
    expect(await accepts({ web: { modules: ["a", ""], adapter: "node" } })).toBe(false);
    expect(await accepts({ web: { modules: [1], adapter: "node" } })).toBe(false);
    expect(await accepts({ web: { modules: ["a", "b", "c"], adapter: "node" } })).toBe(true);
  });

  it("needs an adapter of node, static or client", async () => {
    expect(await accepts({ web: { modules: [] } })).toBe(false);
    expect(await accepts({ web: { modules: [], adapter: "deno" } })).toBe(false);
    expect(await accepts({ web: { modules: [], adapter: "" } })).toBe(false);
    expect(await accepts({ web: { modules: [], adapter: 1 } })).toBe(false);
    for (const adapter of ["node", "static", "client"])
      expect(await accepts({ web: { modules: [], adapter } })).toBe(true);
  });

  it("takes servedBy as an optional non-empty string", async () => {
    expect(await accepts({ web: { ...node, servedBy: "api" } })).toBe(true);
    expect(await accepts({ web: { ...node, servedBy: "" } })).toBe(false);
    expect(await accepts({ web: { ...node, servedBy: 1 } })).toBe(false);
  });

  it("is closed: a key it does not list, `host` included, is refused; origins is taken", async () => {
    expect(await accepts({ web: { ...node, host: "api" } })).toBe(false);
    expect(await accepts({ web: { ...node, storge: "file" } })).toBe(false);
    expect(await accepts({ web: { ...node, origins: { img: { "https://a.example": "r" } } } })).toBe(true);
  });

  it("takes storage as an optional file, sqlite or postgres", async () => {
    for (const storage of ["file", "sqlite", "postgres"])
      expect(await accepts({ web: { ...node, storage } })).toBe(true);
    expect(await accepts({ web: { ...node, storage: "memory" } })).toBe(false);
    expect(await accepts({ web: { ...node, storage: "" } })).toBe(false);
    expect(await accepts({ web: { ...node, storage: 1 } })).toBe(false);
  });

  it("takes shells as optional capacitor and tauri shells, each with a string id and name", async () => {
    const shell = { id: "dev.example.app", name: "App" };
    expect(await accepts({ web: { ...node, shells: {} } })).toBe(true);
    expect(await accepts({ web: { ...node, shells: { capacitor: shell } } })).toBe(true);
    expect(await accepts({ web: { ...node, shells: { tauri: shell } } })).toBe(true);
    expect(await accepts({ web: { ...node, shells: { capacitor: shell, tauri: shell } } })).toBe(true);
    expect(await accepts({ web: { ...node, shells: 1 } })).toBe(false);
    for (const key of ["capacitor", "tauri"]) {
      expect(await accepts({ web: { ...node, shells: { [key]: { id: "x" } } } }), key).toBe(false);
      expect(await accepts({ web: { ...node, shells: { [key]: { name: "x" } } } }), key).toBe(false);
      expect(await accepts({ web: { ...node, shells: { [key]: { id: 1, name: "x" } } } }), key).toBe(false);
      expect(await accepts({ web: { ...node, shells: { [key]: { id: "x", name: 1 } } } }), key).toBe(false);
      expect(await accepts({ web: { ...node, shells: { [key]: 1 } } }), key).toBe(false);
    }
  });

  it("takes caller as an optional object whose days is an integer from 1 to 400", async () => {
    for (const days of [1, 2, 30, 399, 400])
      expect(await accepts({ web: { ...node, caller: { days } } }), `${days}`).toBe(true);
    for (const days of [0, -1, 401, 1000, 1.5, "30", null, undefined])
      expect(await accepts({ web: { ...node, caller: { days } } }), `${days}`).toBe(false);
    expect(await accepts({ web: { ...node, caller: {} } })).toBe(false);
    expect(await accepts({ web: { ...node, caller: 30 } })).toBe(false);
  });

  it("keeps the parsed fields", async () => {
    vi.resetModules();
    const { TopologySchema } = await import("../src/internal/TopologySchema.ts");
    const value = {
      web: {
        modules: ["a"],
        adapter: "client",
        servedBy: "api",
        shells: { tauri: { id: "dev.example.app", name: "App" } },
      },
      api: { modules: ["b"], adapter: "node", storage: "sqlite", caller: { days: 7 } },
    };
    const r = TopologySchema.parse(value);
    expect(r.ok && r.value).toEqual(value);
  });
});
