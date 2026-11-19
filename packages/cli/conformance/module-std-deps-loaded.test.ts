// Spec: k.module, clause "With `@keel/std-brands` in a module's `deps`, `keel check` reports E2101 for a lowercase `s.id` brand; a `deps` package that cannot be imported reports E1159 naming it."
// Seed 1337
// E2101 runs the real binary in a subprocess so the check-rule registry starts empty; E1159 runs in process.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "@keel/cli";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const tmps: string[] = [];
const mkTmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-deps-"));
  tmps.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const manifest = (id: string, deps: string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
    id,
    deps,
    capabilities: [],
    public: { exports: [], routes: [] },
  })})\n`;

type Diag = { code: string; message: string; path: string };
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const diags = (stdout: string): Diag[] => {
  const out: Diag[] = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    if (isRec(v) && v.kind === "diag" && typeof v.code === "string") {
      out.push({ code: v.code, message: String(v.message ?? ""), path: String(v.path ?? "") });
    }
  }
  return out;
};

const project = (deps: string[], brand: string): string => {
  const tmp = mkTmp();
  fs.mkdirSync(path.join(tmp, "modules/a"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "modules/a/module.ts"), manifest("a", deps));
  fs.writeFileSync(
    path.join(tmp, "modules/a/Brand.ts"),
    `import { s } from '@keel/schema'\nexport const Brand = s.id('${brand}')\n`,
  );
  fs.mkdirSync(path.join(tmp, "node_modules/@keel"), { recursive: true });
  for (const p of ["std-brands", "schema"]) {
    fs.symlinkSync(path.join(repo, "packages", p), path.join(tmp, "node_modules/@keel", p));
  }
  return tmp;
};

const bin = (cwd: string): Diag[] => {
  const r = spawnSync(process.execPath, [BIN, "check", "--format=json"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  return diags(r.stdout);
};

const fakePkg = (tmp: string, name: string): void => {
  const dir = path.join(tmp, "node_modules/@keel", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: `@keel/${name}`, type: "module", exports: "./index.js" }),
  );
  fs.writeFileSync(path.join(dir, "index.js"), "export {};\n");
};

describe("k.module: keel check loads the stdlib packages in deps", () => {
  it("With `@keel/std-brands` in a module's `deps`, `keel check` reports E2101 for a lowercase `s.id` brand", () => {
    const codes = bin(project(["@keel/std-brands"], "order")).map((d) => d.code);
    expect(codes).toContain("E2101");
    expect(codes).not.toContain("E1159");
  }, 120_000);

  it("Without `@keel/std-brands` in `deps` nothing is imported, so E2101 is absent", () => {
    const codes = bin(project([], "order")).map((d) => d.code);
    expect(codes).not.toContain("E2101");
  }, 120_000);

  it("A PascalCase `s.id` brand with `@keel/std-brands` in `deps` reports no E2101", () => {
    const codes = bin(project(["@keel/std-brands"], "Order")).map((d) => d.code);
    expect(codes).not.toContain("E2101");
  }, 120_000);

  it("a `deps` package that cannot be imported reports E1159 naming it", async () => {
    // seed 1337
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,10}$/), async (suffix) => {
        const pkg = `@keel/std-nope${suffix}`;
        const tmp = mkTmp();
        const files = [{ path: "modules/a/module.ts", source: manifest("a", [pkg]) }];
        fs.mkdirSync(path.join(tmp, "modules/a"), { recursive: true });
        fs.writeFileSync(path.join(tmp, files[0]?.path ?? ""), files[0]?.source ?? "");
        const r = await run(["check", "--format=json"], { cwd: tmp, files, env: { KEEL_AGENT: "1" } });
        const hits = diags(r.stdout).filter((d) => d.code === "E1159");
        expect(hits.map((d) => d.code)).toContain("E1159");
        expect(hits.some((d) => d.message.includes(pkg))).toBe(true);
      }),
      { seed: 1337, numRuns: 5 },
    );
  }, 120_000);

  it("a `deps` package that can be imported reports no E1159", async () => {
    const tmp = mkTmp();
    fakePkg(tmp, "std-loadable");
    const files = [{ path: "modules/a/module.ts", source: manifest("a", ["@keel/std-loadable"]) }];
    fs.mkdirSync(path.join(tmp, "modules/a"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "modules/a/module.ts"), files[0]?.source ?? "");
    const r = await run(["check", "--format=json"], { cwd: tmp, files, env: { KEEL_AGENT: "1" } });
    expect(diags(r.stdout).map((d) => d.code)).not.toContain("E1159");
  });
});
