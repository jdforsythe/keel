// Spec: k.module, clause "`keel build` writes `.keel/std.json` with each module's `std` config by package and module id; a value failing its package's schema is E1158 naming the path, and nothing is written."
// Seed 1337
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PKG = "@keel/std-artbuild";
const Config = s.object({ limit: s.int({ min: 1, max: 100 }), tags: s.array(s.string({ max: 8 })) });
s.register(PKG, Config);

let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-art-"));
  for (const name of ["std-artbuild", "std-unregistered"]) {
    const dir = path.join(tmp, "node_modules/@keel", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: `@keel/${name}`, type: "module", exports: "./index.js" }),
    );
    fs.writeFileSync(path.join(dir, "index.js"), "export {};\n");
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const manifest = (id: string, deps: string[], std?: unknown): string =>
  `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
    id,
    deps,
    capabilities: [],
    public: { exports: [], routes: [] },
    ...(std === undefined ? {} : { std }),
  })})\n`;

type Mod = { id: string; pkg: string; config?: unknown };
const files = (mods: Mod[]) =>
  mods.map((m) => ({
    path: `modules/${m.id}/module.ts`,
    source: manifest(m.id, [m.pkg], "config" in m ? { [m.pkg]: m.config } : undefined),
  }));

type Diag = { code: string; message: string; path: string };
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
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

const build = async (mods: Mod[]) => {
  const applied: { path: string; content: string | null }[][] = [];
  const r = await run(["build", "--format=json"], {
    cwd: tmp,
    files: files(mods),
    env: { KEEL_AGENT: "1" },
    apply: (w) => {
      applied.push(w.map((x) => ({ path: x.path, content: x.content })));
    },
  });
  const std = applied.flat().find((w) => w.path === ".keel/std.json");
  return { r, codes: diags(r.stdout).map((d) => d.code), diags: diags(r.stdout), std };
};

const validConfig = fc.record({
  limit: fc.integer({ min: 1, max: 100 }),
  tags: fc.array(fc.string({ maxLength: 8 }), { maxLength: 4 }),
});
const moduleIds = fc.uniqueArray(fc.constantFrom("alpha", "beta", "gamma", "delta"), { minLength: 1, maxLength: 3 });

describe("k.module: keel build writes .keel/std.json", () => {
  it("`keel build` writes `.keel/std.json` with each module's `std` config by package and module id", async () => {
    // seed 1337
    await fc.assert(
      fc.asyncProperty(moduleIds, fc.array(validConfig, { minLength: 3, maxLength: 3 }), async (ids, cfgs) => {
        const mods = ids.map((id, i) => ({ id, pkg: PKG, config: cfgs[i] }));
        const { std, codes } = await build(mods);
        expect(codes).not.toContain("E1158");
        const content = std?.content ?? "";
        expect(content.endsWith("\n")).toBe(true);
        const parsed: unknown = JSON.parse(content);
        expect(isRec(parsed) && typeof parsed.hash === "string").toBe(true);
        const expected: Record<string, unknown> = {};
        ids.forEach((id, i) => {
          expected[id] = cfgs[i];
        });
        expect(isRec(parsed) ? parsed.data : undefined).toEqual({ [PKG]: expected });
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  it("`keel build` writes `.keel/std.json` as `{}` data when no module has `std` config", async () => {
    const { std } = await build([{ id: "alpha", pkg: PKG }]);
    const parsed: unknown = JSON.parse(std?.content ?? "null");
    expect(isRec(parsed) ? parsed.data : undefined).toEqual({});
  });

  it("a value failing its package's schema is E1158 naming the path, and nothing is written", async () => {
    // seed 1337
    const bad = fc.oneof(
      fc.constant({ limit: 0, tags: [] }),
      fc.constant({ limit: "ten", tags: [] }),
      fc.integer({ min: 101, max: 1000 }).map((limit) => ({ limit, tags: [] })),
      fc.integer({ min: -1000, max: 0 }).map((limit) => ({ limit, tags: [] })),
    );
    await fc.assert(
      fc.asyncProperty(bad, async (config) => {
        const { codes, diags: ds, std, r } = await build([{ id: "alpha", pkg: PKG, config }]);
        expect(codes).toContain("E1158");
        expect(ds.some((d) => d.code === "E1158" && d.message.includes("limit"))).toBe(true);
        expect(std).toBeUndefined();
        expect(r.code).toBe(1);
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  it("a package whose schema is not registered keeps its value in `.keel/std.json`", async () => {
    const { std, codes } = await build([{ id: "alpha", pkg: "@keel/std-unregistered", config: { limit: 0 } }]);
    expect(codes).not.toContain("E1158");
    const parsed: unknown = JSON.parse(std?.content ?? "null");
    expect(isRec(parsed) ? parsed.data : undefined).toEqual({ "@keel/std-unregistered": { alpha: { limit: 0 } } });
  });
});
