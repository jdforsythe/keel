// Spec: k.scaffold-shell, Conformance "In `p`, `shell { shell: 'tauri', id: 'com.acme.p' }` changes `package.json` and `topology.ts` alone; `web` gains `shells: { tauri: { id: \"com.acme.p\", name: \"P\" } }` as its last property, one property per line, its other properties unchanged; `dependencies` gains `@keel/std-tauri` at `@keel/server`'s text, `devDependencies` gains `@tauri-apps/cli`, nothing else is added, and each object's keys are sorted."
// Seed 1337 (property over ids).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, lowerName, read, snap } from "./fixtures.ts";
import {
  added,
  declared,
  isSorted,
  manifest,
  p,
  section,
  serverText,
  shell,
  shellApply,
  squash,
} from "./shell-support.ts";

const INPUT = { shell: "tauri", id: "com.acme.p" };

describe("scaffold shell tauri in the default project", () => {
  it("changes package.json and topology.ts alone", () => {
    const before = p();
    const r = shell(INPUT, before);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.value.created).toEqual([]);
    expect(r.value.changed.slice().sort()).toEqual(["package.json", "topology.ts"]);
    expect([...r.value.files.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [path, text] of before) {
      if (path !== "package.json" && path !== "topology.ts") expect(r.value.files.get(path), path).toBe(text);
    }
  });

  it("web gains shells: { tauri: { id, name } } as its last property, its other properties unchanged", () => {
    const before = p();
    const after = shellApply(INPUT, before);
    const snippet = `,shells:{tauri:{id:"com.acme.p",name:"P"}}`;
    const top = squash(read(after, "topology.ts"));
    expect(top).toContain(`${snippet}}`);
    expect(top.replace(snippet, "")).toBe(squash(read(before, "topology.ts")));
    expect(top.split("shells:").length).toBe(2);
  });

  it("the deployable is written one property per line", () => {
    const top = read(shellApply(INPUT, p()), "topology.ts");
    const lines = top.split("\n");
    for (const key of ["modules", "adapter", "styles", "shells"]) {
      const hits = lines.filter((l) => l.includes(`${key}:`));
      expect(hits, key).toHaveLength(1);
      expect(hits[0]?.trim().startsWith(`${key}:`), key).toBe(true);
    }
    expect(lines.some((l) => /^\s*web: \{\s*$/.test(l))).toBe(true);
  });

  it("dependencies gains @keel/std-tauri at @keel/server's text and devDependencies gains @tauri-apps/cli, nothing else is added", () => {
    const before = p();
    const after = shellApply(INPUT, before);
    expect(added(before, after, "dependencies")).toEqual({ "@keel/std-tauri": serverText(before) });
    expect(added(before, after, "devDependencies")).toEqual({
      "@tauri-apps/cli": declared("std-tauri", "peerDependencies", "@tauri-apps/cli"),
    });
    const m = manifest(after);
    const b = manifest(before);
    for (const key of Object.keys(b)) {
      if (key !== "dependencies" && key !== "devDependencies") expect(m[key], key).toEqual(b[key]);
    }
    for (const [k, v] of Object.entries(section(before, "dependencies")))
      expect(section(after, "dependencies")[k]).toBe(v);
  });

  it("each object's keys are sorted", () => {
    const m = manifest(shellApply(INPUT, p()));
    expect(isSorted(section(shellApply(INPUT, p()), "dependencies"))).toBe(true);
    expect(isSorted(section(shellApply(INPUT, p()), "devDependencies"))).toBe(true);
    for (const v of Object.values(m)) {
      if (typeof v === "object" && v !== null && !Array.isArray(v))
        expect(isSorted(Object.fromEntries(Object.entries(v)))).toBe(true);
    }
  });

  it("for any reverse-DNS id the entry is written with that id and the input tree is left as it was", () => {
    fc.assert(
      fc.property(lowerName, lowerName, (a, b) => {
        const id = `com.${a}.${b}`;
        const before = p();
        const out = shellApply({ shell: "tauri", id }, before);
        expect(squash(read(out, "topology.ts"))).toContain(`shells:{tauri:{id:"${id}",name:"P"}}`);
        expect(snap(before)).toBe(snap(p()));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
