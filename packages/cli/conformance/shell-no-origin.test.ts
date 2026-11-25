import fc from "fast-check";
// Spec: k.shell, clause "With `web` alone, `keel build --target tauri` with `KEEL_ORIGIN` unset, and with it empty, prints no E1574 and proceeds; `build` is given no `origin` and an `env` without `KEEL_ORIGIN`; the `www` entry's drivers call is `{ connect: [] }` and its `shellMount` call `{ id }`, neither with an `origin`. With `KEEL_PEER_API=https://peer.example` set too, the same."
// k.shell, Without a server "Its shell build reads no `KEEL_ORIGIN` and has no `origin`: the entry passes none to the drivers or `shellMount`, `build` is given none, and its `env` holds no `KEEL_ORIGIN`."
// Seed: 1337 (the peer origin of the last case is generated; the project is fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`) and a topology of `web` alone. This is the proof that an app with no server carries no origin config.
// ASSUMPTIONS: "no `origin`" in `build`'s argument is read as no `origin` key; the minified `www` bundle is read by the object literals of the drivers call and the `shellMount` call (`shell-stub.ts`).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  SEED,
  SLOW,
  UNSET,
  buildCalls,
  cleanup,
  driversArg,
  mountArg,
  run,
  setStub,
  stubProject,
  withCode,
  wwwText,
} from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject({}, false);
}, SLOW);
afterAll(() => cleanup(dir));

const ID = "dev.keel.golden";
const build = (origin: string | null, extra: Record<string, string> = {}) => {
  setStub(dir, {});
  return run(dir, ["build", "--target", "tauri"], origin, "json", extra);
};

/**
 * The generated case builds 2 peers times 2 origins per property run, two property runs: 8 `keel build`s, 10.5 s alone
 * here, 1.3 s a build. The allowance is 60 s a build: 1.3 s times 10 (a runner ten times slower) times 3 (the suite
 * runs files in parallel) times 1.5 (margin), 59 s rounded up, so at scale 0.1 each build has 6 s.
 */
const BUILD_RUN = 60_000;
const PEER_CASE_BOUND = 2 * 2 * 2 * BUILD_RUN;

describe("k.shell: a shell build with no node deployable", () => {
  test(
    "with `web` alone, `keel build --target tauri` with `KEEL_ORIGIN` unset, and with it empty, prints no E1574 and proceeds",
    () => {
      for (const origin of [UNSET, ""]) {
        const before = buildCalls(dir).length;
        const r = build(origin);
        expect(withCode(r, "E1574"), String(origin)).toEqual([]);
        expect(r.status, r.out).toBe(0);
        expect(buildCalls(dir)).toHaveLength(before + 1);
      }
    },
    SLOW,
  );

  test(
    "with `web` alone, `build` is given no `origin` and an `env` without `KEEL_ORIGIN`",
    () => {
      for (const origin of [UNSET, ""]) {
        expect(build(origin).status).toBe(0);
        const call = buildCalls(dir).at(-1);
        expect(call).toBeDefined();
        expect(call?.keys).not.toContain("origin");
        expect(call?.origin).toBeUndefined();
        expect(call?.envKeys).not.toContain("KEEL_ORIGIN");
        expect(call?.connect).toEqual([]);
      }
    },
    SLOW,
  );

  test(
    "with `web` alone, the `www` entry's drivers call is `{ connect: [] }` and its `shellMount` call `{ id }`, neither with an `origin`",
    () => {
      for (const origin of [UNSET, ""]) {
        expect(build(origin).status).toBe(0);
        const text = wwwText(dir);
        expect(driversArg(text)).toBe("{connect:[]}");
        expect(mountArg(text, ID)).toBe(`{id:"${ID}"}`);
      }
    },
    SLOW,
  );

  test(
    "with `web` alone and `KEEL_PEER_API=https://peer.example` set too, the build is the same: no `origin`, no `KEEL_ORIGIN` in `env`, `{ connect: [] }` and `{ id }`",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z]{3,10}$/), (label) => {
          for (const peer of ["https://peer.example", `https://${label}.example`]) {
            for (const origin of [UNSET, ""]) {
              const r = build(origin, { KEEL_PEER_API: peer });
              expect(withCode(r, "E1574")).toEqual([]);
              expect(r.status, r.out).toBe(0);
              const call = buildCalls(dir).at(-1);
              expect(call?.keys).not.toContain("origin");
              expect(call?.envKeys).not.toContain("KEEL_ORIGIN");
              expect(call?.connect).toEqual([]);
              const text = wwwText(dir);
              expect(driversArg(text)).toBe("{connect:[]}");
              expect(mountArg(text, ID)).toBe(`{id:"${ID}"}`);
              expect(text).not.toContain(peer);
            }
          }
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    PEER_CASE_BOUND,
  );
});
