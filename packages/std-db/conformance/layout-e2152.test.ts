// Spec: std.db, Conformance "An empty database opens at layout 1; a database at layout 2 is E2152 and exit 1."
// Spec: std.db, Rules "E2152 the database's `layout` is newer than the package's (at startup)"
// Seed: 1337.
// Assumption: the spec does not say whether `sqlite(url)` / `postgres(url)` call `process.exit(1)` themselves or reject and leave the exit to the caller.
// These tests need the exit code 1 and the text E2152 on stdout or stderr from the driver alone: SQLite runs in a real child process that opens the
// driver and nothing else; Postgres on PGlite runs in-process with `process.exit` replaced by a throw, and output captured.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type Kind, type Rig, SEED, makeRig, openScript, spawnNode, writeScript } from "./fixtures.ts";

const rigs: Rig[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const r of rigs.splice(0)) await r.stop();
});
const rig = async (kind: Kind): Promise<Rig> => {
  const r = await makeRig(kind);
  rigs.push(r);
  return r;
};

/** Opens the driver on a database at `layout` and reports how the process ended. */
async function openAt(kind: Kind, layout: number): Promise<{ exit: number | null; output: string }> {
  const r = await rig(kind);
  await r.seedLayout(layout);
  if (kind === "sqlite") {
    const script = writeScript(r.dir, "open.mjs", openScript("sqlite"));
    const p = spawnNode(script, { KEEL_DATABASE_URL: pathToFileURL(join(r.dir, "keel.sqlite")).href });
    try {
      const { code } = await p.exited;
      return { exit: code, output: p.output() };
    } finally {
      await p.stop();
    }
  }
  let output = "";
  let exit: number | null = null;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    output += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    output += String(chunk);
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation((code?: string | number | null): never => {
    exit = typeof code === "number" ? code : null;
    throw new Error("process.exit");
  });
  try {
    await r.open();
  } catch (e) {
    output += String(e instanceof Error ? e.message : e);
  }
  vi.restoreAllMocks();
  return { exit, output };
}

for (const kind of ["sqlite", "postgres"] as const) {
  describe(`${kind} driver`, () => {
    test.skip("An empty database opens at layout 1.", async () => {
      const r = await rig(kind);
      expect(await r.layout().catch(() => null)).toBeNull();
      await r.open();
      expect(await r.layout()).toBe("1");
    });

    test.skip("a database at layout 2 is E2152 and exit 1.", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 2, max: 50 }), async (newer) => {
          const { exit, output } = await openAt(kind, newer);
          expect(exit).toBe(1);
          expect(output).toContain("E2152");
        }),
        { seed: SEED, numRuns: 3 },
      );
    });

    test.skip("E2152 fires when the database's `layout` is newer than the package's, at startup, and not at layout 1.", async () => {
      const newer = await openAt(kind, 2);
      expect(newer.output).toContain("E2152");
      expect(newer.exit).toBe(1);
      const same = await openAt(kind, 1);
      expect(same.output).not.toContain("E2152");
      expect(same.exit === null || same.exit === 0).toBe(true);
    });
  });
}
