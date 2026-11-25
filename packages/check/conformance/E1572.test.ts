// Spec: k.deploy, clause "`storage: 'sqlite'` without `@keel/std-db` in `dependencies` is one E1572 whose fix adds it; with it, none."
// k.deploy, Rules "E1572 a deployable's `storage` or `shells` needs a package the app's `dependencies` lack (fix adds it)."
// Seed: 1337.
// ASSUMPTION: `check` reads `topology.ts` and `package.json` from the file list; the fix is a unified diff of `package.json`, applied below to its text.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const pkg = (deps: readonly string[]): string =>
  `${JSON.stringify({ name: "fx", private: true, version: "1.0.0", dependencies: Object.fromEntries(deps.map((d) => [d, "workspace:*"])) }, null, 2)}\n`;

type Declaration = { readonly adapter: "node" | "client"; readonly extra: string; readonly needs: string };
const DECLARATIONS: Record<string, Declaration> = {
  sqlite: { adapter: "node", extra: "storage: 'sqlite'", needs: "@keel/std-db" },
  postgres: { adapter: "node", extra: "storage: 'postgres'", needs: "@keel/std-db" },
  tauri: {
    adapter: "client",
    extra: "shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }",
    needs: "@keel/std-tauri",
  },
  capacitor: {
    adapter: "client",
    extra: "shells: { capacitor: { id: 'dev.keel.golden', name: 'Golden' } }",
    needs: "@keel/std-capacitor",
  },
};

const project = (d: Declaration, deps: readonly string[]): Files => [
  { path: "package.json", source: pkg(deps) },
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: '${d.adapter}', ${d.extra} } })\n`,
  },
  { path: "modules/app/module.ts", source: MANIFEST("app") },
];
const e1572 = (files: Files) => check(files, { types: false }).diagnostics.filter((x) => x.code === "E1572");

/** Applies the hunks of a unified diff (headers optional) to `text`. */
function applyDiff(text: string, diff: string): string {
  const old = text.split("\n");
  const lines = diff.split("\n");
  const out: string[] = [];
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    const head = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(lines[i] ?? "");
    if (head === null) continue;
    const start = Number(head[1]) - 1;
    while (at < start) out.push(old[at++] ?? "");
    for (i++; i < lines.length && !(lines[i] ?? "").startsWith("@@"); i++) {
      const l = lines[i] ?? "";
      if (l.startsWith("\\")) continue;
      if (l.startsWith(" ")) {
        out.push(l.slice(1));
        at++;
      } else if (l.startsWith("-")) at++;
      else if (l.startsWith("+")) out.push(l.slice(1));
    }
    i--;
  }
  while (at < old.length) out.push(old[at++] ?? "");
  return out.join("\n");
}

const others = fc.uniqueArray(fc.constantFrom("@keel/ui", "@keel/forms", "@keel/std-money", "@keel/std-i18n"), {
  maxLength: 3,
});

describe("k.deploy: E1572", () => {
  test("`storage: 'sqlite'` without `@keel/std-db` in `dependencies` is one E1572 whose fix adds it; with it, none.", () => {
    fc.assert(
      fc.property(others, (deps) => {
        const d = DECLARATIONS["sqlite"];
        if (d === undefined) throw new Error("declaration");
        const found = e1572(project(d, deps));
        expect(found).toHaveLength(1);
        const fix = found[0]?.fix;
        expect(typeof fix).toBe("string");
        const fixed = applyDiff(pkg(deps), String(fix));
        expect(fixed).toContain("@keel/std-db");
        expect(e1572(project(d, [...deps, "@keel/std-db"]))).toEqual([]);
        expect(e1572([{ path: "package.json", source: fixed }, ...project(d, deps).slice(1)])).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("E1572 a deployable's `storage` or `shells` needs a package the app's `dependencies` lack (fix adds it).", () => {
    for (const [, d] of Object.entries(DECLARATIONS)) {
      const found = e1572(project(d, []));
      expect(found, d.extra).toHaveLength(1);
      expect(String(found[0]?.message)).toContain(d.needs);
      expect(applyDiff(pkg([]), String(found[0]?.fix))).toContain(d.needs);
      expect(e1572(project(d, [d.needs])), d.extra).toEqual([]);
    }
  });

  test("E1572 is not reported for `storage: 'file'`, the default, or a deployable declaring neither `storage` nor `shells`", () => {
    const plain = (extra: string): Files => [
      { path: "package.json", source: pkg([]) },
      {
        path: "topology.ts",
        source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: 'node'${extra} } })\n`,
      },
      { path: "modules/app/module.ts", source: MANIFEST("app") },
    ];
    expect(e1572(plain(""))).toEqual([]);
    expect(e1572(plain(", storage: 'file'"))).toEqual([]);
  });
});
