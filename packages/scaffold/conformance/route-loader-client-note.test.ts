// k.scaffold, Generators "`route`: contract entry and binding (k.contract), page component, route test (one without `app` passes `identity.ts`'s default export as `mount` when the project has it, k.testing), and a `*.server.ts` loader when a `node` deployable lists the module or `--loader` asks for one (in a module only `client` deployables list it runs in the browser, k.boundary, and the run prints the `scaffold.note` `note <file> the loader runs in the browser and its file ships in the client bundle`); with `--no-loader`, or by default elsewhere, no loader file and a binding of `component` alone." (no Conformance bullet of the section holds it yet; cited as a plain comment, not a `// Spec:` line)
// RFC 0247, Conformance (after the second review): in a fresh `client` project `keel scaffold route app.news --loader` exits 0, writes `modules/app/loadNews.server.ts`, and prints exactly one line `note modules/app/loadNews.server.ts the loader runs in the browser and its file ships in the client bundle` (json: one `scaffold.note` record `{ kind, path, note }`); in a fresh `node` project the same command prints no `note` line.
// seed 1337 (property over route names). The real `keel` binary over a materialized project, compact and json.
// ASSUMED: json `note` holds the sentence after the file in the compact line ("the loader runs in the browser and its file ships in the client bundle"); `loadNews` follows `app.news`, so a name `zqabc` writes `loadZqabc.server.ts`.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, lowerName } from "./fixtures.ts";
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { clientProject, keelCompact, nodeProject } from "./rfc0247-support.ts";
import { BOUND } from "./shell-support.ts";

const NOTE = "the loader runs in the browser and its file ships in the client bundle";
const file = (name: string): string => `modules/app/load${name.charAt(0).toUpperCase()}${name.slice(1)}.server.ts`;
const noteLines = (out: string): string[] => out.split("\n").filter((l) => l.startsWith("note "));

describe("k.scaffold route: the loader note", () => {
  it(
    "in a fresh client project `keel scaffold route app.news --loader` exits 0, writes modules/app/loadNews.server.ts and prints exactly one note line (compact)",
    () => {
      const dir = materialize(clientProject());
      try {
        const r = keelCompact(dir, ["scaffold", "route", "app.news", "--loader"]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(readTree(dir).has("modules/app/loadNews.server.ts")).toBe(true);
        expect(noteLines(r.stdout)).toEqual([`note modules/app/loadNews.server.ts ${NOTE}`]);
      } finally {
        cleanup(dir);
      }
    },
    BOUND,
  );

  it(
    "in the same run, json holds one scaffold.note record { kind, path, note }",
    () => {
      const dir = materialize(clientProject());
      try {
        const r = keel(dir, ["scaffold", "route", "app.news", "--loader"]);
        expect(r.status, r.stdout).toBe(0);
        const notes = r.records.filter((x) => x.kind === "scaffold.note");
        expect(notes).toHaveLength(1);
        expect(notes[0]).toEqual({ kind: "scaffold.note", path: "modules/app/loadNews.server.ts", note: NOTE });
      } finally {
        cleanup(dir);
      }
    },
    BOUND,
  );

  it(
    "for any route name in a fresh client project, --loader prints exactly one note line naming the loader file it wrote",
    () => {
      fc.assert(
        fc.property(lowerName, (n) => {
          const dir = materialize(clientProject());
          try {
            const r = keelCompact(dir, ["scaffold", "route", `app.${n}`, "--loader"]);
            expect(r.status, r.stdout + r.stderr).toBe(0);
            expect(readTree(dir).has(file(n))).toBe(true);
            expect(noteLines(r.stdout)).toEqual([`note ${file(n)} ${NOTE}`]);
          } finally {
            cleanup(dir);
          }
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    BOUND * 4,
  );

  it(
    "in a fresh node project `keel scaffold route app.news --loader` prints no note line and no scaffold.note record",
    () => {
      const dir = materialize(nodeProject());
      try {
        const c = keelCompact(dir, ["scaffold", "route", "app.news", "--loader"]);
        expect(c.status, c.stdout + c.stderr).toBe(0);
        expect(readTree(dir).has("modules/app/loadNews.server.ts")).toBe(true);
        expect(noteLines(c.stdout)).toEqual([]);
      } finally {
        cleanup(dir);
      }
      const dir2 = materialize(nodeProject());
      try {
        const j = keel(dir2, ["scaffold", "route", "app.news", "--loader"]);
        expect(j.status).toBe(0);
        expect(j.records.filter((x) => x.kind === "scaffold.note")).toEqual([]);
      } finally {
        cleanup(dir2);
      }
    },
    BOUND * 2,
  );

  it(
    "in a fresh node project the same command without --loader writes the loader by default and prints no note line",
    () => {
      const dir = materialize(nodeProject());
      try {
        const r = keelCompact(dir, ["scaffold", "route", "app.news"]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(readTree(dir).has("modules/app/loadNews.server.ts")).toBe(true);
        expect(noteLines(r.stdout)).toEqual([]);
      } finally {
        cleanup(dir);
      }
    },
    BOUND,
  );
});
