// Seed 1337. `run` (k.create) over real folders: the files written are exactly the plan's (`--dry-run`'s `create`
// records), byte for byte, for any kind and name (property); a refusal writes nothing; the flags' usage errors exit 2.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Process } from "../src/Process.ts";
import { parseFlags } from "../src/parseFlags.ts";
import { run } from "../src/run.ts";

const SEED = 1337;
const proc = (cwd: string, argv: string[]): Process => ({
  argv,
  cwd,
  nodeVersion: "22.15.0",
  tty: false,
  env: { npm_config_user_agent: "pnpm/9.12.0 node/v22.15.0" },
});
const walk = (dir: string, rel = ""): string[] => {
  let names: string[] = [];
  try {
    names = readdirSync(join(dir, rel));
  } catch {
    return [];
  }
  return names.flatMap((n) => {
    const p = rel === "" ? n : `${rel}/${n}`;
    return statSync(join(dir, p)).isDirectory() ? walk(dir, p) : [p];
  });
};
const records = (stdout: string): { kind: string; [k: string]: unknown }[] =>
  stdout
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => {
      const v: unknown = JSON.parse(l);
      return typeof v === "object" && v !== null ? { kind: String(Reflect.get(v, "kind")), ...v } : { kind: "" };
    });

describe("create-app run", () => {
  it(
    "the files written are the plan's `create` records, for any kind and name (property)",
    () => {
      const kind = fc.constantFrom([], ["--adapter", "static"], ["--adapter", "node"], ["--library", "@acme/charts"]);
      const name = fc
        .stringMatching(/^[a-z][a-z0-9-]{0,12}$/)
        .filter((n) => !["vite", "vitest", "typescript", "happy-dom"].includes(n));
      fc.assert(
        fc.property(kind, name, (flags, n) => {
          const cwd = tempDir("keel-createrun-");
          const dry = run(proc(cwd, [n, ...flags, "--dry-run", "--format=json"]));
          expect(dry.code, dry.stdout).toBe(0);
          expect(walk(cwd)).toEqual([]);
          const planned = records(dry.stdout)
            .filter((r) => r.kind === "scaffold.edit")
            .map((r) => String(r.path));
          const made = run(proc(cwd, [n, ...flags, "--format=json"]));
          expect(made.code, made.stdout).toBe(0);
          expect(walk(join(cwd, n)).sort()).toEqual([...planned].sort());
          const again = run(proc(cwd, [n, ...flags, "--existing", "--format=json"]));
          expect(again.code).toBe(1);
          expect(again.stdout).toContain("E1361");
          expect(readFileSync(join(cwd, n, "package.json"), "utf8")).toContain('"name"');
        }),
        { seed: SEED, numRuns: 8 },
      );
    },
    testTime(60_000),
  );

  it("a refusal writes nothing and exits 1; a usage error exits 2", () => {
    const cwd = tempDir("keel-createrun-");
    expect(run(proc(cwd, ["Bad Name"])).code).toBe(1);
    expect(run({ ...proc(cwd, ["shop"]), nodeVersion: "20.11.0" }).stdout).toContain("E1362");
    expect(run(proc(cwd, ["a", "b"])).code).toBe(2);
    expect(walk(cwd)).toEqual([]);
  });

  it("parses each flag in both forms and refuses what is not one", () => {
    expect(parseFlags(["shop", "--adapter=node", "--name", "x", "--dry-run"])).toMatchObject({
      folder: "shop",
      adapter: "node",
      name: "x",
      dryRun: true,
    });
    for (const bad of [["--adapter", "deno"], ["--name"], ["--limit", "0"], ["--nope"], ["--format=xml"]])
      expect(parseFlags(bad)).toHaveProperty("usage");
  });
});
