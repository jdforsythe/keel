// Spec: k.scaffold-shell, Conformance "In a project where `keel build` ran, the operation writes no file under `.keel/`, `deploy/` or `dist/`, and its trailer is `ok scaffold shell 0 created, 2 changed, 0 removed`, with no `artifacts`. Two runs on equal trees give equal edit sets; `--dry-run` writes nothing and prints the diff a following apply writes."
// Spec: k.scaffold, Refresh "`--dry-run`, a project with no such artifact, and `shell`, refresh nothing."
// Seed 1337 (property over ids and names). ASSUMED json edit record, as dry-run.test.ts: { kind: "scaffold.edit", action, path, diff }.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, fresh, lowerName, snap } from "./fixtures.ts";
import { type CliRecord, cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { BOUND, keelText, p, shell, shellApply } from "./shell-support.ts";
import { type PrintedEdit, applyEdits } from "./unified-diff.ts";

const TRAILER = "ok scaffold shell 0 created, 2 changed, 0 removed";

describe("scaffold shell in a built project", () => {
  for (const kind of ["tauri", "capacitor"]) {
    it(
      `${kind}: writes no file under .keel/, deploy/ or dist/; the trailer is ${TRAILER} with no artifacts`,
      () => {
        const dir = materialize(fresh());
        try {
          const built = keel(dir, ["build"]);
          expect(built.status, JSON.stringify(built.records)).toBe(0);
          const before = readTree(dir);
          const r = keelText(dir, ["scaffold", "shell", kind, "--id", "com.acme.shop"]);
          expect(r.status, r.lines.join("\n")).toBe(0);
          expect(r.lines.at(-1)).toBe(TRAILER);
          expect(r.lines.join("\n")).not.toContain("artifacts");
          expect(r.lines.slice(0, -1).sort()).toEqual(["change package.json", "change topology.ts"]);
          const after = readTree(dir);
          expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
          const differing = [...after].filter(([path, text]) => before.get(path) !== text).map(([path]) => path);
          expect(differing.sort()).toEqual(["package.json", "topology.ts"]);
        } finally {
          cleanup(dir);
        }
      },
      BOUND,
    );
  }
});

describe("scaffold shell, determinism", () => {
  it("two runs on equal trees give equal edit sets", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("tauri", "capacitor"),
        lowerName,
        fc.option(lowerName, { nil: undefined }),
        (kind, a, name) => {
          const input = { shell: kind, id: `com.${a}.app`, ...(name === undefined ? {} : { name }) };
          const one = shell(input, p());
          const two = shell(input, p());
          expect(one.ok).toBe(true);
          expect(two.ok).toBe(true);
          if (one.ok && two.ok) {
            expect(one.value.created).toEqual(two.value.created);
            expect(one.value.changed).toEqual(two.value.changed);
            expect(snap(one.value.files)).toBe(snap(two.value.files));
          }
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("the call writes nothing into the tree it is given and the following apply is the same edit set", () => {
    const files = p();
    const before = snap(files);
    const dry = shell({ shell: "tauri", id: "com.acme.p" }, files);
    expect(snap(files)).toBe(before);
    expect(dry.ok).toBe(true);
    if (dry.ok) expect(snap(dry.value.files)).toBe(snap(shellApply({ shell: "tauri", id: "com.acme.p" }, files)));
  });
});

function printedEdits(records: CliRecord[]): PrintedEdit[] {
  const out: PrintedEdit[] = [];
  for (const r of records) {
    if (r.kind !== "scaffold.edit") continue;
    const { action, path, diff } = r;
    if (
      (action === "create" || action === "change" || action === "remove") &&
      typeof path === "string" &&
      typeof diff === "string"
    )
      out.push({ action, path, diff });
    else throw new Error(`malformed scaffold.edit record: ${JSON.stringify(r)}`);
  }
  return out;
}

const cli: [string, string[]][] = [
  ["scaffold shell tauri --id com.acme.p", ["scaffold", "shell", "tauri", "--id", "com.acme.p"]],
  [
    "scaffold shell capacitor --id com.acme.p --name 'Acme Shop' --to web",
    ["scaffold", "shell", "capacitor", "--id", "com.acme.p", "--name", "Acme Shop", "--to", "web"],
  ],
];

describe("keel scaffold shell --dry-run", () => {
  for (const [name, args] of cli) {
    it(
      `${name} --dry-run writes nothing and prints exactly the diff the following apply writes`,
      () => {
        const dir = materialize(p());
        try {
          const before = readTree(dir);
          const dry = keel(dir, [...args, "--dry-run"]);
          expect(dry.status, JSON.stringify(dry.records)).toBe(0);
          expect(readTree(dir)).toEqual(before);
          const edits = printedEdits(dry.records);
          expect(edits.map((e) => `${e.action} ${e.path}`).sort()).toEqual([
            "change package.json",
            "change topology.ts",
          ]);
          const patched = applyEdits(before, edits);
          const real = keel(dir, args);
          expect(real.status, JSON.stringify(real.records)).toBe(0);
          const after = readTree(dir);
          expect([...after.keys()].sort()).toEqual([...patched.keys()].sort());
          for (const [path, content] of after) expect(patched.get(path), path).toBe(content);
        } finally {
          cleanup(dir);
        }
      },
      BOUND,
    );
  }
});
