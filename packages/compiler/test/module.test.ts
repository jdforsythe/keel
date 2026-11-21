// module() (k.module manifest) and the shipped strict tsconfig profile.
import fs from "node:fs";
import path from "node:path";
import { module, ModuleSchema } from "@keel/compiler";
import { describe, expect, it } from "vitest";

const def = { id: "todos", deps: [], capabilities: ["net"], public: { exports: ["TodoRow"] } };

describe("module", () => {
  it("returns a valid manifest unchanged and frozen", () => {
    const m = module(def);
    expect(m).toEqual(def);
    expect(Object.isFrozen(m)).toBe(true);
    expect(ModuleSchema.parse(m).ok).toBe(true);
  });

  it("throws keel.module for a schema failure or a non-lowerCamel id", () => {
    expect(() => module({ ...def, id: "Todos" })).toThrow(/lowerCamel/);
    expect(() => module({ ...def, id: "" })).toThrow(/module manifest/);
    try {
      module({ ...def, id: "to-dos" });
    } catch (e) {
      expect(e instanceof Error ? Reflect.get(e, "code") : undefined).toBe("keel.module");
    }
  });
});

describe("ModuleSchema", () => {
  it("applies the lowerCamel id rule on parse and encode alike", () => {
    const bad = { ...def, id: "to-dos" };
    expect(ModuleSchema.parse(def).ok).toBe(true);
    const r = ModuleSchema.parse(bad);
    expect(r.ok ? [] : r.error.data.issues).toEqual([{ path: ["id"], rule: "type" }]);
    expect(r.ok ? "" : r.error.message).toContain("lowerCamel");
    expect(() => ModuleSchema.encode(bad)).toThrow(/lowerCamel/);
    expect(ModuleSchema.encode(def)).toEqual(def);
  });

  it("refuses any key of public but exports, routes included", () => {
    expect(ModuleSchema.parse({ ...def, public: { exports: [], routes: [] } }).ok).toBe(false);
    expect(() => module({ ...def, public: { exports: [], routes: ["todos.index"] } })).toThrow(/module manifest/);
  });
});

describe("tsconfig.strict.json", () => {
  it("parses as JSON, is strict, and leaves jsxImportSource unset", () => {
    const file = path.join(import.meta.dirname, "..", "tsconfig.strict.json");
    const v: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    const opts = typeof v === "object" && v !== null ? Reflect.get(v, "compilerOptions") : undefined;
    expect(opts).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      jsx: "preserve",
    });
    expect(typeof opts === "object" && opts !== null && "jsxImportSource" in opts).toBe(false);
  });
});
