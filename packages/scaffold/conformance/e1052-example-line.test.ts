// k.scaffold, Rules "A generator's E1052 for a missing input names a line formed from the project: the first module in sorted order (`app` without one; `keel scaffold route app.about` in a fresh app), for `transaction` that module's first store (`cart` without one), for `service` `--base https://a.test`, with `--reason geo` where E1358 asks for one; run as written, it succeeds." (no Conformance bullet of the section holds it yet; cited as a plain comment, not a `// Spec:` line)
// RFC 0247, Conformance (after the second review): in a fresh `client` project, `keel scaffold route`, `store`, `component`, `transaction` and `service` with no id are each E1052 whose line names `app` (`keel scaffold route app.about`, `store app.cart`, `component app/OrderCard`, `transaction app.cart.addItem`, `service app --base https://a.test --reason geo`), and in a fresh `node` project `service`'s line holds no `--reason`; running each line as printed, `store` before `transaction`, exits 0.
// seed 1337 (property over module and store names). The real `keel` binary over a materialized project, compact output.
// ASSUMED: the line is the rest of the output line from `keel scaffold <op>`; where the project's first module is not `app` the line names that module (sorted order), and `transaction`'s line names the first store of that module (a module holding one store, so "first" is unambiguous).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, apply, lowerName } from "./fixtures.ts";
import { cleanup, materialize, readTree } from "./keel-cli.ts";
import { argvOf, clientProject, exampleLine, keelCompact, nodeProject } from "./rfc0247-support.ts";
import { BOUND } from "./shell-support.ts";

const OPS = ["route", "store", "component", "transaction", "service"] as const;

/** Runs `keel scaffold <op>` with no id, expects E1052, returns the example line it names. */
function missing(dir: string, op: string): string {
  const r = keelCompact(dir, ["scaffold", op]);
  const out = r.stdout + r.stderr;
  expect(r.status, out).not.toBe(0);
  expect(out, op).toContain("E1052");
  const line = exampleLine(out, op);
  expect(line, out).toBeDefined();
  return line ?? "";
}
/** Runs a printed line as written (the argv after `keel`) in `dir`. */
function runLine(dir: string, line: string): void {
  const argv = argvOf(line);
  expect(argv.slice(0, 1), line).toEqual(["keel"]);
  const r = keelCompact(dir, argv.slice(1));
  expect(r.status, `${line}\n${r.stdout}${r.stderr}`).toBe(0);
}

describe("k.scaffold Rules: a generator's E1052 line, formed from the project", () => {
  it(
    "in a fresh client project each generator's E1052 names the line the spec gives for `app`",
    () => {
      const dir = materialize(clientProject());
      try {
        expect(missing(dir, "route")).toBe("keel scaffold route app.about");
        expect(missing(dir, "store")).toBe("keel scaffold store app.cart");
        expect(missing(dir, "component")).toBe("keel scaffold component app/OrderCard");
        expect(missing(dir, "transaction")).toBe("keel scaffold transaction app.cart.addItem");
        expect(argvOf(missing(dir, "service")).slice(1)).toEqual([
          "scaffold",
          "service",
          "app",
          "--base",
          "https://a.test",
          "--reason",
          "geo",
        ]);
        expect([...readTree(dir).keys()]).toEqual([...clientProject().keys()].sort());
      } finally {
        cleanup(dir);
      }
    },
    BOUND * 2,
  );

  it(
    "in a fresh node project `service`'s line names app and --base https://a.test and holds no --reason",
    () => {
      const dir = materialize(nodeProject());
      try {
        const line = missing(dir, "service");
        expect(argvOf(line).slice(1)).toEqual(["scaffold", "service", "app", "--base", "https://a.test"]);
        expect(line).not.toContain("--reason");
      } finally {
        cleanup(dir);
      }
    },
    BOUND,
  );

  it(
    "running each line as printed in the same fresh client project, store before transaction, exits 0",
    () => {
      const dir = materialize(clientProject());
      try {
        const lines = new Map<string, string>();
        for (const op of OPS) lines.set(op, missing(dir, op));
        for (const op of ["route", "store", "transaction", "component", "service"]) runLine(dir, lines.get(op) ?? "");
      } finally {
        cleanup(dir);
      }
    },
    BOUND * 4,
  );

  it(
    "running each line as printed in the same fresh node project exits 0 (service without --reason)",
    () => {
      const dir = materialize(nodeProject());
      try {
        const lines = new Map<string, string>();
        for (const op of OPS) lines.set(op, missing(dir, op));
        for (const op of ["route", "store", "transaction", "component", "service"]) runLine(dir, lines.get(op) ?? "");
      } finally {
        cleanup(dir);
      }
    },
    BOUND * 4,
  );

  it(
    "for any module that sorts before `app` and holds one store, route, store and component lines name that module and transaction's names that store",
    () => {
      fc.assert(
        fc.property(
          lowerName.map((n) => `a${n.slice(2)}`).filter((n) => n < "app"),
          lowerName,
          (m, s) => {
            let files = clientProject();
            files = apply("module", { id: m }, files).files;
            files = apply("store", { id: `${m}.${s}` }, files).files;
            const dir = materialize(files);
            try {
              expect(missing(dir, "route")).toMatch(new RegExp(`^keel scaffold route ${m}\\.`));
              expect(missing(dir, "store")).toMatch(new RegExp(`^keel scaffold store ${m}\\.`));
              expect(missing(dir, "component")).toMatch(new RegExp(`^keel scaffold component ${m}/`));
              expect(missing(dir, "transaction")).toMatch(new RegExp(`^keel scaffold transaction ${m}\\.${s}\\.`));
              expect(argvOf(missing(dir, "service")).slice(0, 3)).toEqual(["keel", "scaffold", "service"]);
              expect(argvOf(missing(dir, "service"))[3]).toBe(m);
              for (const op of ["route", "transaction"]) runLine(dir, missing(dir, op));
            } finally {
              cleanup(dir);
            }
          },
        ),
        { seed: SEED, numRuns: 3 },
      );
    },
    BOUND * 12,
  );
});
