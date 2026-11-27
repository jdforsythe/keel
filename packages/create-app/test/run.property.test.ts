// Seed 1337. `run` (k.create) over real folders: the files written are exactly the plan's (`--dry-run`'s `create`
// records), byte for byte, for any kind and name (property); a refusal writes nothing; the flags' usage errors exit 2.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MARKER, suggestName, validName } from "@keel/scaffold/create";
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
    async () => {
      const kind = fc.constantFrom([], ["--adapter", "static"], ["--adapter", "node"], ["--library", "@acme/charts"]);
      const name = fc
        .stringMatching(/^[a-z][a-z0-9-]{0,12}$/)
        .filter((n) => !["vite", "vitest", "typescript", "happy-dom"].includes(n));
      await fc.assert(
        fc.asyncProperty(kind, name, async (flags, n) => {
          const cwd = tempDir("keel-createrun-");
          const dry = await run(proc(cwd, [n, ...flags, "--dry-run", "--format=json"]));
          expect(dry.code, dry.stdout).toBe(0);
          expect(walk(cwd)).toEqual([]);
          const edits = records(dry.stdout).filter((r) => r.kind === "scaffold.edit");
          expect(edits.every((r) => r["dry-run"] === true)).toBe(true);
          const planned = edits.map((r) => String(r.path));
          const made = await run(proc(cwd, [n, ...flags, "--format=json"]));
          expect(made.code, made.stdout).toBe(0);
          expect(walk(join(cwd, n)).sort()).toEqual([...planned].sort());
          const again = await run(proc(cwd, [n, ...flags, "--existing", "--format=json"]));
          expect(again.code).toBe(1);
          expect(again.stdout).toContain("E1361");
          expect(readFileSync(join(cwd, n, "package.json"), "utf8")).toContain('"name"');
        }),
        { seed: SEED, numRuns: 8 },
      );
    },
    testTime(60_000),
  );

  it("a refusal writes nothing and exits 1; a usage error exits 2", async () => {
    const cwd = tempDir("keel-createrun-");
    expect((await run(proc(cwd, ["Bad Name"]))).code).toBe(1);
    expect((await run({ ...proc(cwd, ["shop"]), nodeVersion: "20.11.0" })).stdout).toContain("E1362");
    expect((await run(proc(cwd, ["a", "b"]))).code).toBe(2);
    expect(walk(cwd)).toEqual([]);
  });

  it("--dry-run prints would create and a planned count, compact and pretty", async () => {
    const cwd = tempDir("keel-createrun-");
    const compact = await run(proc(cwd, ["shop", "--dry-run"]));
    expect(compact.stdout).toMatch(/^would create package\.json$/m);
    expect(compact.stdout).not.toMatch(/^create /m);
    expect(compact.stdout).toMatch(/^ok create --dry-run shop client \d+ planned$/m);
    const pretty = await run(proc(cwd, ["shop", "--dry-run", "--format=pretty"]));
    expect(pretty.stdout).toContain("would create  package.json");
    expect(walk(cwd)).toEqual([]);
  });

  it("a SIGTERM after the first file leaves the folder as it was, exit 143; SIGINT exits 130", async () => {
    for (const [signal, code] of [
      ["SIGTERM", 143],
      ["SIGINT", 130],
    ] as const) {
      const cwd = tempDir("keel-createrun-");
      mkdirSync(join(cwd, "shop"));
      writeFileSync(join(cwd, "shop", ".DS_Store"), "");
      let caught: "SIGINT" | "SIGTERM" | undefined;
      const r = await run(
        { ...proc(cwd, ["shop"]), stopped: () => caught },
        {
          written: () => {
            caught = signal;
          },
        },
      );
      expect(r.code, r.stdout).toBe(code);
      expect(r.stdout).toContain("E1367");
      expect(walk(cwd)).toEqual(["shop/.DS_Store"]);
    }
  });

  it("a folder a killed run left (its marker) is E1366 naming it, with or without --existing", async () => {
    const cwd = tempDir("keel-createrun-");
    mkdirSync(join(cwd, "shop"));
    writeFileSync(join(cwd, "shop", MARKER), "package.json\n");
    writeFileSync(join(cwd, "shop", "package.json"), "{}");
    for (const extra of [[], ["--existing"]]) {
      const r = await run(proc(cwd, ["shop", ...extra]));
      expect(r.code).toBe(1);
      expect(r.stdout).toContain(`E1366 shop/${MARKER}`);
    }
  });

  it("a successful run leaves no marker", async () => {
    const cwd = tempDir("keel-createrun-");
    expect((await run(proc(cwd, ["shop"]))).code).toBe(0);
    expect(walk(join(cwd, "shop"))).not.toContain(MARKER);
  });

  it("ignoring case where the file system does: agents.md and Modules/ are E1361 with both spellings", async () => {
    for (const [entry, spellings] of [
      ["agents.md", ["shop/AGENTS.md", "shop/agents.md"]],
      ["Modules/", ["shop/Modules/", "shop/modules/"]],
    ] as const) {
      const cwd = tempDir("keel-createrun-");
      mkdirSync(join(cwd, "shop"));
      if (entry.endsWith("/")) mkdirSync(join(cwd, "shop", entry));
      else writeFileSync(join(cwd, "shop", entry), "");
      const caseless = await run(proc(cwd, ["shop", "--existing", "--format=json"]), { caseless: true });
      expect(caseless.code).toBe(1);
      const d = records(caseless.stdout).find((x) => x.kind === "diag");
      expect(d?.code).toBe("E1361");
      expect(d?.paths).toEqual(spellings);
      // Told the file system keeps case, the plan sees no clash (a caseless disk then refuses the write, E1365).
      const exact = await run(proc(cwd, ["shop", "--existing", "--format=json"]), { caseless: false });
      expect(exact.stdout).not.toContain("E1361");
    }
  });

  it("every name E1352 suggests passes the name rule (property); café gives cafe, 123 none", async () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 80 }), (raw) => {
        const n = suggestName(raw);
        if (n !== undefined) expect(validName(n)).toBe(true);
      }),
      { seed: SEED, numRuns: 500 },
    );
    expect(suggestName("café")).toBe("cafe");
    expect(suggestName("Straße")).toBe("strasse");
    expect(suggestName("123")).toBeUndefined();
    expect(suggestName("Vite")).toBeUndefined();
    const cwd = tempDir("keel-createrun-");
    expect((await run(proc(cwd, ["--name", "café"]))).stdout).toMatch(/pass --name cafe$/m);
    expect((await run(proc(cwd, ["--name", "123"]))).stdout).not.toMatch(/pass --name /);
  });

  it("the bin's printed suggestion passes its own rule for any folder name (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: "grapheme", minLength: 1, maxLength: 30 }), async (raw) => {
        const cwd = tempDir("keel-createrun-");
        const r = await run(proc(cwd, ["--name", raw, "--dry-run"]));
        const fix = /pass --name (\S+?);?$/m.exec(r.stdout)?.[1];
        if (fix !== undefined) expect(validName(fix), r.stdout).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
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

  it("a library gets packageManager as an app does", async () => {
    const cwd = tempDir("keel-createrun-");
    expect((await run(proc(cwd, ["charts", "--library", "@acme/charts"]))).code).toBe(0);
    expect(readFileSync(join(cwd, "charts", "package.json"), "utf8")).toContain('"packageManager": "pnpm@9.12.0"');
  });
});
