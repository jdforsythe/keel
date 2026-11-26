// depsReport (k.evidence deps.json): each production dependency `pnpm list --prod --json --depth Infinity` reports,
// once per name and version, as a CycloneDX 1.5 component with its lockfile integrity and its package.json license.
// Each project is a small pnpm layout in the OS temp directory (outside the workspace, so `pnpm list` reads it alone);
// no network request is made. Seed 1337.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { depsReport } from "../src/internal/depsReport.ts";

const SLOW = fixedTime(180_000);
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const write = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

type Pkg = { name: string; version: string; license?: unknown; integrity?: string; deps?: Record<string, string> };
const dirOf = (p: Pkg): string => `${p.name.replace("/", "+")}@${p.version}`;
const keyOf = (p: Pkg): string => (p.name.startsWith("@") ? `'${p.name}@${p.version}'` : `${p.name}@${p.version}`);

/** A pnpm install of `direct` (all of `all`, a package's own dependencies listed in `deps`) at a fresh temp directory. */
const install = (
  all: Pkg[],
  direct: string[],
  links: Record<string, { version: string; license?: string }> = {},
): string => {
  const root = mkdtempSync(join(tmpdir(), "keel-deps-"));
  dirs.push(root);
  const specs = (names: string[]): string =>
    names
      .map((n) => {
        const p = all.find((x) => x.name === n);
        return `      '${n}':\n        specifier: ${p?.version}\n        version: ${p?.version}\n`;
      })
      .join("");
  const linkSpecs = Object.keys(links)
    .map((n) => `      ${n}:\n        specifier: link:./${n}\n        version: link:./${n}\n`)
    .join("");
  const lock = [
    "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n",
    specs(direct),
    linkSpecs,
    "\npackages:\n\n",
    ...all.map((p) =>
      p.integrity === undefined
        ? `  ${keyOf(p)}:\n    resolution: {tarball: https://example.test/${p.name}.tgz}\n\n`
        : `  ${keyOf(p)}:\n    resolution: {integrity: ${p.integrity}}\n\n`,
    ),
    "snapshots:\n\n",
    ...all.map((p) => {
      const d = Object.entries(p.deps ?? {});
      return d.length === 0
        ? `  ${keyOf(p)}: {}\n\n`
        : `  ${keyOf(p)}:\n    dependencies:\n${d.map(([n, v]) => `      '${n}': ${v}\n`).join("")}\n`;
    }),
  ].join("");
  write(join(root, "pnpm-lock.yaml"), lock);
  write(join(root, "node_modules", ".pnpm", "lock.yaml"), lock);
  write(
    join(root, "node_modules", ".modules.yaml"),
    "layoutVersion: 5\nnodeLinker: isolated\npackageManager: pnpm@9.12.0\nstoreDir: /tmp/store\nvirtualStoreDir: .pnpm\nincluded:\n  dependencies: true\n  devDependencies: true\n  optionalDependencies: true\nskipped: []\n",
  );
  write(
    join(root, "package.json"),
    JSON.stringify({
      name: "app",
      version: "1.0.0",
      dependencies: {
        ...Object.fromEntries(direct.map((n) => [n, all.find((x) => x.name === n)?.version])),
        ...Object.fromEntries(Object.keys(links).map((n) => [n, `link:./${n}`])),
      },
    }),
  );
  for (const p of all) {
    const at = join(root, "node_modules", ".pnpm", dirOf(p), "node_modules", p.name);
    write(
      join(at, "package.json"),
      JSON.stringify({ name: p.name, version: p.version, ...(p.license === undefined ? {} : { license: p.license }) }),
    );
    for (const [n, v] of Object.entries(p.deps ?? {})) {
      const target = all.find((x) => x.name === n && x.version === v);
      if (target === undefined) continue;
      const linkAt = join(root, "node_modules", ".pnpm", dirOf(p), "node_modules", n);
      mkdirSync(dirname(linkAt), { recursive: true });
      symlinkSync(join(root, "node_modules", ".pnpm", dirOf(target), "node_modules", n), linkAt);
    }
  }
  for (const n of direct) {
    const p = all.find((x) => x.name === n);
    if (p === undefined) continue;
    const linkAt = join(root, "node_modules", n);
    mkdirSync(dirname(linkAt), { recursive: true });
    symlinkSync(join(root, "node_modules", ".pnpm", dirOf(p), "node_modules", n), linkAt);
  }
  for (const [n, l] of Object.entries(links)) {
    write(join(root, n, "package.json"), JSON.stringify({ name: n, version: l.version, license: l.license }));
    symlinkSync(join(root, n), join(root, "node_modules", n));
  }
  return root;
};

const FOO: Pkg = { name: "foo", version: "1.2.3", license: "MIT", integrity: "sha256-AQID", deps: { baz: "2.0.0" } };
const BAZ: Pkg = { name: "baz", version: "2.0.0", integrity: "sha512-/wA=" };
const PKGS: Pkg[] = [
  FOO,
  BAZ,
  { name: "@sc/bar", version: "0.1.0", license: "ISC" },
  { name: "qux", version: "3.0.0", license: { type: "MIT" }, integrity: "sha1-AAAA" },
  { name: "wide", version: "1.0.0", license: "0BSD", integrity: "sha384-AAEC" },
];

describe("depsReport", () => {
  test(
    "depsReport lists each dependency, transitive ones too, as a CycloneDX 1.5 component sorted by purl",
    () => {
      const root = install(PKGS, ["foo", "@sc/bar", "qux", "wide"]);
      const r = depsReport(root, null);
      expect(r.bomFormat).toBe("CycloneDX");
      expect(r.specVersion).toBe("1.5");
      expect(r.advisories).toBeNull();
      expect(r.components.map((c) => c.purl)).toEqual([
        "pkg:npm/%40sc/bar@0.1.0",
        "pkg:npm/baz@2.0.0",
        "pkg:npm/foo@1.2.3",
        "pkg:npm/qux@3.0.0",
        "pkg:npm/wide@1.0.0",
      ]);
      for (const c of r.components) expect(c.type).toBe("library");
      expect(r.components.map((c) => [c.name, c.version])).toEqual([
        ["@sc/bar", "0.1.0"],
        ["baz", "2.0.0"],
        ["foo", "1.2.3"],
        ["qux", "3.0.0"],
        ["wide", "1.0.0"],
      ]);
    },
    SLOW,
  );

  test(
    "the lockfile integrity becomes a hash: sha256, sha384 and sha512 in hex; another algorithm or none is no hash",
    () => {
      const r = depsReport(install(PKGS, ["foo", "@sc/bar", "qux", "wide"]), null);
      const by = (n: string) => r.components.find((c) => c.name === n)?.hashes;
      expect(by("foo")).toEqual([{ alg: "SHA-256", content: "010203" }]);
      expect(by("baz")).toEqual([{ alg: "SHA-512", content: "ff00" }]);
      expect(by("wide")).toEqual([{ alg: "SHA-384", content: "000102" }]);
      expect(by("qux")).toEqual([]);
      expect(by("@sc/bar")).toEqual([]);
    },
    SLOW,
  );

  test(
    "the license is the package.json's string license; an absent or non-string one is none",
    () => {
      const r = depsReport(install(PKGS, ["foo", "@sc/bar", "qux", "wide"]), null);
      const by = (n: string) => r.components.find((c) => c.name === n)?.licenses;
      expect(by("foo")).toEqual([{ license: { name: "MIT" } }]);
      expect(by("@sc/bar")).toEqual([{ license: { name: "ISC" } }]);
      expect(by("wide")).toEqual([{ license: { name: "0BSD" } }]);
      expect(by("baz")).toEqual([]);
      expect(by("qux")).toEqual([]);
    },
    SLOW,
  );

  test(
    "a workspace link takes the version and license of the package it links",
    () => {
      const r = depsReport(install([FOO, BAZ], ["foo"], { local: { version: "4.5.6", license: "Apache-2.0" } }), null);
      const local = r.components.find((c) => c.name === "local");
      expect(local).toEqual({
        type: "library",
        name: "local",
        version: "4.5.6",
        purl: "pkg:npm/local@4.5.6",
        hashes: [],
        licenses: [{ license: { name: "Apache-2.0" } }],
      });
    },
    SLOW,
  );

  test(
    "advisories are carried as given",
    () => {
      const root = install([BAZ], ["baz"]);
      const adv = [{ id: 1, module: "baz", severity: "low", title: "t", url: "u", vulnerable: "<3", patched: ">=3" }];
      expect(depsReport(root, adv).advisories).toEqual(adv);
      expect(depsReport(root, []).advisories).toEqual([]);
      expect(depsReport(root, null).advisories).toBeNull();
    },
    SLOW,
  );

  test(
    "a directory pnpm cannot list gives no components, never a throw",
    () => {
      const empty = mkdtempSync(join(tmpdir(), "keel-deps-"));
      dirs.push(empty);
      const r = depsReport(empty, null);
      expect(r).toEqual({ bomFormat: "CycloneDX", specVersion: "1.5", components: [], advisories: null });
    },
    SLOW,
  );

  test(
    "property: the hash content is the hex of the integrity's base64 bytes, whatever the digest",
    () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 24 }),
          fc.constantFrom("256", "384", "512"),
          (bytes, bits) => {
            const b64 = Buffer.from(bytes).toString("base64");
            const pkg: Pkg = { name: "dig", version: "1.0.0", license: "MIT", integrity: `sha${bits}-${b64}` };
            const r = depsReport(install([pkg], ["dig"]), null);
            expect(r.components[0]?.hashes).toEqual([
              { alg: `SHA-${bits}`, content: Buffer.from(bytes).toString("hex") },
            ]);
          },
        ),
        { seed: 1337, numRuns: 6 },
      );
    },
    SLOW * 2,
  );
});
