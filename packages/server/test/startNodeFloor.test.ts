// `start` on `storage: 'sqlite'` checks the running Node against 22.13 before the driver's `open` (k.deploy Rules E1560).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { start } from "../src/internal/start.ts";
import type { StartOptions } from "../src/types/StartOptions.ts";

type Storage = "file" | "sqlite" | "postgres";
const SECRET = "s".repeat(32);
const built = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-floor-"));
  fs.mkdirSync(path.join(d, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(d, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(d, ".vite/manifest.json"),
    JSON.stringify({ e: { file: "assets/entry-Ab12Cd34.js", isEntry: true } }),
  );
  fs.writeFileSync(path.join(d, "assets/entry-Ab12Cd34.js"), "resume()");
  return d;
};
const dirs: string[] = [];

const realExit = Reflect.get(process, "exit");
const exits: unknown[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Reflect.set(process, "exit", realExit);
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const run = async (
  storage: Storage,
  node: string,
): Promise<{ out: string[]; opens: number; stop: (() => void) | undefined }> => {
  vi.stubEnv("PORT", "0");
  vi.stubEnv("KEEL_SECRET", SECRET);
  if (storage === "postgres") vi.stubEnv("KEEL_DATABASE_URL", "postgres://db.example/app");
  const out: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((t) => {
    out.push(String(t));
    return true;
  });
  exits.length = 0;
  Reflect.set(process, "exit", (code: unknown) => {
    exits.push(code);
  });
  let opens = 0;
  const data = new Map<string, string>();
  const open: NonNullable<StartOptions["open"]> = async () => {
    opens += 1;
    return {
      get: async (k) => data.get(k) ?? null,
      set: async (k, v) => {
        data.set(k, v);
      },
      read: async (ks) => ks.map((k) => data.get(k) ?? null),
      commit: async () => true,
    };
  };
  const dir = built();
  dirs.push(dir);
  const sig = vi.spyOn(process, "on");
  await start(
    {
      topology: { web: { modules: [], adapter: "node", storage } },
      deployable: "web",
      routes: [],
      runners: {},
      dir,
      ...(storage === "file" ? {} : { open }),
    },
    node,
  );
  const handler = sig.mock.calls.find((c) => c[0] === "SIGTERM")?.[1];
  sig.mockRestore();
  return { out, opens, stop: typeof handler === "function" ? () => handler("SIGTERM") : undefined };
};

const listens = async (storage: Storage, node: string): Promise<number> => {
  const r = await run(storage, node);
  await vi.waitFor(() => expect(r.out.some((l) => l.startsWith("ok listening on port "))).toBe(true));
  expect(r.out.filter((l) => l.startsWith("E1560"))).toEqual([]);
  if (r.stop === undefined) throw new Error("no SIGTERM handler");
  r.stop();
  await vi.waitFor(() => expect(exits).toEqual([0]));
  return r.opens;
};

describe("start: the Node floor for storage 'sqlite'", () => {
  it("an older Node is one E1560 naming the floor and the version, exit 1, and open is never called", async () => {
    for (const node of ["22.12.0", "22.9.0", "22.5.1", "20.18.0", "18.20.4"]) {
      const r = await run("sqlite", node);
      expect(r.out).toEqual([`E1560 storage 'sqlite' needs Node 22.13 or newer; this is ${node}\n`]);
      expect(exits).toEqual([1]);
      expect(r.opens).toBe(0);
    }
  });

  it("with KEEL_FORMAT=json it is one diag record with no URL and no path", async () => {
    vi.stubEnv("KEEL_FORMAT", "json");
    vi.stubEnv("KEEL_DATABASE_URL", "file:/data/secret.sqlite");
    const r = await run("sqlite", "22.11.0");
    expect(exits).toEqual([1]);
    expect(r.opens).toBe(0);
    expect(r.out).toHaveLength(1);
    const rec: unknown = JSON.parse(r.out.join(""));
    expect(rec).toMatchObject({
      kind: "diag",
      code: "E1560",
      message: "storage 'sqlite' needs Node 22.13 or newer; this is 22.11.0",
    });
    expect(r.out.join("")).not.toContain("secret");
  });

  it("every version below 22.13 by major and minor is refused before open", async () => {
    const older = fc.oneof(
      fc.tuple(fc.integer({ min: 0, max: 21 }), fc.integer({ min: 0, max: 99 }), fc.nat(99)),
      fc.tuple(fc.constant(22), fc.integer({ min: 0, max: 12 }), fc.nat(99)),
    );
    await fc.assert(
      fc.asyncProperty(older, async ([a, b, c]) => {
        const node = `${a}.${b}.${c}`;
        const r = await run("sqlite", node);
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        return exits.length === 1 && exits[0] === 1 && r.opens === 0 && r.out.length === 1;
      }),
      { seed: 1337, numRuns: 40 },
    );
  });

  it("22.13.0, 22.20.1 and 24.0.0 start and open the driver once", async () => {
    for (const node of ["22.13.0", "22.20.1", "24.0.0"]) {
      expect(await listens("sqlite", node)).toBe(1);
      vi.restoreAllMocks();
    }
  });

  it("'file' and 'postgres' storage are not checked", async () => {
    expect(await listens("file", "20.0.0")).toBe(0);
    vi.restoreAllMocks();
    expect(await listens("postgres", "20.0.0")).toBe(1);
  });
});
