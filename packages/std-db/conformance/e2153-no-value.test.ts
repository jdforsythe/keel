// Spec: std.db, clause "A refused connection prints one E2153 naming `KEEL_DATABASE_URL` and no part of its value."
// std.db, Rules "E2153 the database cannot be opened or refuses the connection, naming `KEEL_DATABASE_URL` and no part of its value (at startup)"
// Seed: 1337.
// Assumption: a child process opens the driver on `KEEL_DATABASE_URL` and nothing else, with no catch, so whatever the driver prints is the whole output;
// the spec does not say whether the driver prints E2153 itself or throws and leaves the print to the generated entry (k.deploy: "a failure: ... E2153, exit 1").
// Refusal on Postgres: nothing listens on 127.0.0.1 port 1. Refusal on SQLite: a path under a directory that does not exist.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Kind, SEED, openScript, removeDir, spawnNode, tempDir, writeScript } from "./fixtures.ts";

const secretWord = fc.stringMatching(/^[a-z]{8,12}$/);

async function refused(
  kind: Kind,
  a: string,
  b: string,
  c: string,
): Promise<{ output: string; needles: string[]; code: number | null }> {
  const dir = tempDir();
  try {
    const [url, needles] =
      kind === "postgres"
        ? [`postgres://u${a}:p${b}@127.0.0.1:1/d${c}?sslmode=disable`, [`u${a}`, `p${b}`, `d${c}`]]
        : [pathToFileURL(join(dir, `n${a}`, `f${b}`, `d${c}.sqlite`)).href, [`n${a}`, `f${b}`, `d${c}`]];
    const script = writeScript(dir, "open.mjs", openScript(kind));
    const p = spawnNode(script, { KEEL_DATABASE_URL: url });
    try {
      const { code } = await p.exited;
      return { output: p.output(), needles: [...needles, url], code };
    } finally {
      await p.stop();
    }
  } finally {
    removeDir(dir);
  }
}

for (const kind of ["postgres", "sqlite"] as const) {
  test(`A refused connection prints one E2153 naming \`KEEL_DATABASE_URL\` and no part of its value (${kind}).`, async () => {
    await fc.assert(
      fc.asyncProperty(secretWord, secretWord, secretWord, async (a, b, c) => {
        const { output, needles } = await refused(kind, a, b, c);
        expect(output.split("\n").filter((l) => l.includes("E2153")).length).toBe(1);
        expect(output).toContain("KEEL_DATABASE_URL");
        for (const needle of needles) expect(output).not.toContain(needle);
      }),
      { seed: SEED, numRuns: 3 },
    );
  });

  test(`E2153 fires when the database cannot be opened, at startup, and the process does not report opened (${kind}).`, async () => {
    const { output, code } = await refused(kind, "aaaaaaaa", "bbbbbbbb", "cccccccc");
    expect(output).toContain("E2153");
    expect(output).not.toContain("opened");
    expect(code).not.toBe(0);
  });
}
