// k.scaffold-shell, Edits "A package already listed in `dependencies` or `devDependencies` is kept as written, except a `plugins` entry (k.shell Plugins) at another version text, which is set to the declared one."
// Spec: k.scaffold-shell, clause "A `package.json` with `@tauri-apps/cli` `^2` in `devDependencies` keeps it; one with `@capacitor/app` `^8.0.0` in `dependencies` gets the declared version, `keel check` then reporting no E1572 for it."
// Seed 1337 (property over kept ranges).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures.ts";
import { cleanup, keel, materialize } from "./keel-cli.ts";
import { BOUND, declared, editManifest, p, rec, section, shellApply } from "./shell-support.ts";

const ID = "com.acme.p";
const range = fc.constantFrom("^2", "~2.1.0", ">=2", "latest", "2.0.0", "workspace:*");

describe("scaffold shell, entries already in package.json", () => {
  it("@tauri-apps/cli ^2 in devDependencies is kept", () => {
    const files = editManifest(p(), (m) => {
      m.devDependencies = { ...rec(m.devDependencies), "@tauri-apps/cli": "^2" };
    });
    const out = shellApply({ shell: "tauri", id: ID }, files);
    expect(section(out, "devDependencies")["@tauri-apps/cli"]).toBe("^2");
    expect(section(out, "dependencies")["@keel/std-tauri"]).toBeDefined();
  });

  it("any CLI or platform package already listed is kept as written, in the field it is in", () => {
    fc.assert(
      fc.property(range, fc.constantFrom("dependencies", "devDependencies"), (r, field) => {
        const files = editManifest(p(), (m) => {
          m[field] = { ...rec(m[field]), "@capacitor/cli": r };
        });
        const out = shellApply({ shell: "capacitor", id: ID }, files);
        expect(section(out, field)["@capacitor/cli"]).toBe(r);
        const other = field === "dependencies" ? "devDependencies" : "dependencies";
        expect(section(out, other)["@capacitor/cli"]).toBeUndefined();
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("@capacitor/app ^8.0.0 in dependencies is set to the declared version", () => {
    const files = editManifest(p(), (m) => {
      m.dependencies = { ...rec(m.dependencies), "@capacitor/app": "^8.0.0" };
    });
    const out = shellApply({ shell: "capacitor", id: ID }, files);
    expect(section(out, "dependencies")["@capacitor/app"]).toBe(
      declared("std-capacitor", "dependencies", "@capacitor/app"),
    );
  });

  it("any plugin entry at another version text is set to the declared one", () => {
    fc.assert(
      fc.property(range, fc.constantFrom("@capacitor/app", "@capacitor/preferences"), (r, plugin) => {
        const files = editManifest(p(), (m) => {
          m.dependencies = { ...rec(m.dependencies), [plugin]: r };
        });
        const out = shellApply({ shell: "capacitor", id: ID }, files);
        expect(section(out, "dependencies")[plugin]).toBe(declared("std-capacitor", "dependencies", plugin));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it(
    "after @capacitor/app ^8.0.0 is set, keel check reports no E1572 for it",
    () => {
      const files = editManifest(p(), (m) => {
        m.dependencies = { ...rec(m.dependencies), "@capacitor/app": "^8.0.0" };
      });
      const out = shellApply({ shell: "capacitor", id: ID }, files);
      const dir = materialize(out);
      try {
        const r = keel(dir, ["check"]);
        const named = r.records.filter(
          (x) => x.kind === "diag" && x.code === "E1572" && String(x.message).includes("@capacitor/app"),
        );
        expect(named, JSON.stringify(r.records)).toEqual([]);
      } finally {
        cleanup(dir);
      }
    },
    BOUND,
  );
});
