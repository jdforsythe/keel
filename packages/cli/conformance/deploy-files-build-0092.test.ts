// Spec: k.deploy, clause "With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow."
// k.deploy (rfc:0092)
// Seed 1337 (the byte position comes from `fc.nat`). The real binary (the host `Io` path of `build`) over a temp project with
// `@keel/*` and `vite` linked; `keel check` reads E1005. The fix is applied with the small unified-diff applier below.
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { SEED, diags, keel, materialize } from "./compat-support.ts";

const SLOW = 300_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = (id: string, path: string): string =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(${id}, { '${id}.page': { component: Page } })\n`;
const contractSrc = (id: string, path: string): string =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '${path}' } })\n`;
const pageSrc =
  "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>page</Text>\n    </Box>\n  )\n}\n";
const topologySrc = (bIn: "x" | "y"): string =>
  "import { topology } from '@keel/server'\n" +
  "export default topology({\n" +
  `  x: { modules: ['a'${bIn === "x" ? ", 'b'" : ""}], adapter: 'node' },\n` +
  `  y: { modules: [${bIn === "y" ? "'b'" : ""}${bIn === "y" ? ", " : ""}'d'], adapter: 'node' },\n` +
  "  w: { modules: ['c'], adapter: 'client' },\n" +
  "})\n";

const files = (bIn: "x" | "y"): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts": topologySrc(bIn),
  "modules/a/module.ts": manifestSrc("a"),
  "modules/a/Page.tsx": pageSrc,
  "modules/a/routes.ts": routesSrc("a", "/a"),
  "modules/a/a.contract.ts": contractSrc("a", "/a"),
  "modules/b/module.ts": manifestSrc("b"),
  "modules/b/Page.tsx": pageSrc,
  "modules/b/routes.ts": routesSrc("b", "/b"),
  "modules/b/b.contract.ts": contractSrc("b", "/b"),
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx": pageSrc,
  "modules/c/routes.ts": routesSrc("c", "/"),
  "modules/c/c.contract.ts": contractSrc("c", "/"),
  "modules/d/module.ts": manifestSrc("d"),
  "modules/d/Page.tsx": pageSrc,
  "modules/d/routes.ts": routesSrc("d", "/d"),
  "modules/d/d.contract.ts": contractSrc("d", "/d"),
});

let dir = "";
beforeAll(() => {
  dir = materialize(files("y"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Every file under `root` but `node_modules`, `dist` and `.vite`, by relative path. */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e === "dist" || e === ".vite") continue;
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(root, full), readFileSync(full, "utf8"));
    }
  };
  walk(root);
  return out;
}

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

const writeFile = (rel: string, text: string): void => {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  try {
    writeFileSync(full, text);
  } catch {
    chmodSync(full, 0o644);
    writeFileSync(full, text);
  }
};

test(
  "With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.",
  () => {
    const built = keel(dir, ["build"]);
    expect(built.status).toBe(0);
    const before = snapshot(dir);
    const dockerfiles = [...before.keys()].filter((p) => /(^|\/)Dockerfile$/.test(p)).sort();
    expect(dockerfiles).toEqual(["deploy/x/Dockerfile", "deploy/y/Dockerfile"]);
    expect(before.has("deploy/compose.yaml")).toBe(true);
    expect(before.has(".github/workflows/ci.yml")).toBe(true);
    expect(diags(keel(dir, ["check"]), "E1005")).toEqual([]);

    const generated = ["deploy/x/Dockerfile", "deploy/y/Dockerfile", "deploy/compose.yaml"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...generated), fc.nat(), (rel, n) => {
        const original = before.get(rel) ?? "";
        const at = n % original.length;
        const tampered = `${original.slice(0, at)}${original[at] === "#" ? "%" : "#"}${original.slice(at + 1)}`;
        try {
          writeFile(rel, tampered);
          const found = diags(keel(dir, ["check"]), "E1005").filter((d) => d.path === rel);
          expect(found).toHaveLength(1);
          const fix = found[0]?.fix;
          expect(typeof fix).toBe("string");
          expect(applyDiff(tampered, String(fix))).toBe(original);
        } finally {
          writeFile(rel, original);
        }
      }),
      { seed: SEED, numRuns: 3 },
    );

    writeFile("topology.ts", topologySrc("x"));
    expect(keel(dir, ["build"]).status).toBe(0);
    const after = snapshot(dir);
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter((p) => before.get(p) !== after.get(p));
    expect(changed).toContain("topology.ts");
    for (const p of changed) {
      expect(p === "topology.ts" || p.startsWith("deploy/") || p === ".github/workflows/ci.yml", p).toBe(true);
    }
  },
  SLOW,
);
