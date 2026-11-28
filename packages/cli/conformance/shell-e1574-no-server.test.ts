// Spec: k.shell, clause "With `web` alone and `KEEL_ORIGIN=https://app.example`, the build prints one E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it`, holding no part of the value, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`."
// k.shell, Build 2 "With none, a `KEEL_ORIGIN` set and not empty is E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it` ... Neither names the value."
// Seed: 1337 (the value is generated, valid and invalid; the project is fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`) and a topology of `web` alone. The compact line is read as `E1574 <message>` then `  see: pnpm keel docs k.shell` (RFC 0200, Problem and Proposal); an empty value counts as unset (no E1574), covered by shell-no-origin.test.ts.
import { existsSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, buildCalls, cleanup, run, setStub, stubProject, withCode } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject({}, false);
}, SLOW);
afterAll(() => cleanup(dir));

const MESSAGE = "KEEL_ORIGIN is set and topology.ts has no node deployable to answer it";

describe("k.shell: E1574 with no node deployable", () => {
  test(
    "with `web` alone and `KEEL_ORIGIN=https://app.example`, the build prints one E1574 with the exact message, holding no part of the value, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`",
    () => {
      setStub(dir, {});
      const r = run(dir, ["build", "--target", "tauri"], "https://app.example", "json");
      const found = withCode(r, "E1574");
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toBe(MESSAGE);
      expect(r.out).not.toContain("app.example");
      expect(r.status).toBe(1);
      expect(existsSync(join(dir, "dist", "web", "tauri"))).toBe(false);
      expect(buildCalls(dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "the E1574 line of a `KEEL_ORIGIN` set with no `node` deployable is `E1574 KEEL_ORIGIN is set and topology.ts has no node deployable to answer it` then `see: pnpm keel docs k.shell`",
    () => {
      setStub(dir, {});
      const r = run(dir, ["build", "--target", "tauri"], "https://app.example", "compact", {
        npm_config_user_agent: "pnpm/11.0.0 node/v22.0.0",
      });
      expect(r.out).toContain(`E1574 ${MESSAGE}\n  see: pnpm keel docs k.shell`);
      expect(r.out.match(/E1574/g) ?? []).toHaveLength(1);
    },
    SLOW,
  );

  test(
    "a `KEEL_ORIGIN` set and not empty, valid or not, is that E1574 and names no part of the value",
    () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{3,10}$/).map((l) => `q9${l}`),
          (host) => {
            for (const value of [
              `https://${host}.example`,
              `http://localhost:8080/${host}`,
              `http://${host}.example`,
              `${host}.example`,
              `ftp://${host}`,
            ]) {
              setStub(dir, {});
              const r = run(dir, ["build", "--target", "tauri"], value, "json");
              const found = withCode(r, "E1574");
              expect(found, value).toHaveLength(1);
              expect(found[0]?.message).toBe(MESSAGE);
              expect(r.out).not.toContain(host);
              expect(r.status).toBe(1);
              expect(existsSync(join(dir, "dist", "web", "tauri"))).toBe(false);
              expect(buildCalls(dir)).toEqual([]);
            }
          },
        ),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );
});
