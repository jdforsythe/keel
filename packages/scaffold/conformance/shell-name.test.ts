// Spec: k.scaffold-shell, Input "`name` (`--name`) is the shell's title; its default is the `package.json` `name` with any `@scope/` dropped, split at `-`, `_` and `.`, each word's first letter upper-cased, joined by spaces (`native-tauri` gives `Native Tauri`)."
// Spec: k.scaffold-shell, Conformance "In `pw`, `tauri` with no `name` gives `name: \"Native Tauri\"`; a `package.json` `name` of `@acme/my_app.desktop` gives `My App Desktop`; `name: 'Acme'` is written as given; no `package.json` `name` and no `name` is E1052."
// Seed 1337 (property over words and separators).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, errText, lowerName, read, snap } from "./fixtures.ts";
import { editManifest, pw, shell, shellApply, squash } from "./shell-support.ts";

const ID = "dev.keel.nativetauri";
const nameOf = (files: Map<string, string>): string => squash(read(files, "topology.ts"));

describe("scaffold shell name", () => {
  it("in pw, tauri with no name gives name: Native Tauri", () => {
    expect(nameOf(shellApply({ shell: "tauri", id: ID }, pw()))).toContain(`name:"Native Tauri"`);
  });

  it("a package.json name of @acme/my_app.desktop gives My App Desktop", () => {
    const files = editManifest(pw(), (m) => {
      m.name = "@acme/my_app.desktop";
    });
    expect(nameOf(shellApply({ shell: "tauri", id: ID }, files))).toContain(`name:"My App Desktop"`);
  });

  it("any package.json name splits at - _ and . into words, each upper-cased at its first letter, joined by spaces", () => {
    fc.assert(
      fc.property(
        fc.array(lowerName, { minLength: 1, maxLength: 4 }),
        fc.array(fc.constantFrom("-", "_", "."), { minLength: 4, maxLength: 4 }),
        fc.boolean(),
        (words, seps, scoped) => {
          const base = words.map((w, i) => (i === 0 ? w : `${seps[i - 1]}${w}`)).join("");
          const files = editManifest(pw(), (m) => {
            m.name = scoped ? `@acme/${base}` : base;
          });
          const expected = words.map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`).join(" ");
          expect(nameOf(shellApply({ shell: "tauri", id: ID }, files))).toContain(`name:"${expected}"`);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("name: 'Acme' is written as given", () => {
    const out = nameOf(shellApply({ shell: "tauri", id: ID, name: "Acme" }, pw()));
    expect(out).toContain(`name:"Acme"`);
    expect(out).not.toContain("Native Tauri");
  });

  it("a given name is written as given whatever the package.json name", () => {
    fc.assert(
      fc.property(lowerName, (w) => {
        const given = `Zq ${w} app`;
        expect(nameOf(shellApply({ shell: "tauri", id: ID, name: given }, pw()))).toContain(`name:"${given}"`);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("no package.json name and no name is E1052, nothing written", () => {
    const files = editManifest(pw(), (m) => {
      m.name = undefined;
    });
    const before = snap(files);
    const r = shell({ shell: "tauri", id: ID }, files);
    expect(r.ok).toBe(false);
    expect(errText(r)).toContain("E1052");
    expect(snap(files)).toBe(before);
  });

  it("no package.json name with a name given is not E1052", () => {
    const files = editManifest(pw(), (m) => {
      m.name = undefined;
    });
    const r = shell({ shell: "tauri", id: ID, name: "Acme" }, files);
    expect(r.ok, errText(r)).toBe(true);
  });
});
