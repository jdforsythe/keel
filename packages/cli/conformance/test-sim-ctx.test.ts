// Spec: k.ctx, clause "`keel test` runs under sim by default: a ctx created with no options inside a test is sim, with seed 0."
// Spec: k.testing, Harness "`keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim."
// Spec: k.cli, Commands "`test [paths]` | harness under sim ctx (k.testing)".
// The real `keel` binary runs `keel test` over a temp project (OS tmpdir) whose test builds `createCtx({})` with no
// options and records what it got. Control: the same project under plain vitest, without `keel`, sees `real`, so
// this test fails if `keel test` stopped setting the sim contract. No generated inputs; seed n/a.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, keel, makeProject, plainVitest, removeFile, removeProject, summaryOf } from "./test-sim-project.ts";

const PROBE_TEST = `import { writeFileSync } from "node:fs";
import { createCtx, register } from "@keel/ctx";
import { expect, it } from "vitest";

const probe = register("simProbe", {
  real: () => ({ mode: "real" }),
  shell: () => ({ mode: "shell" }),
  sim: () => ({ mode: "sim" }),
});

it("a ctx created with no options inside the test is sim and seeded", () => {
  const a = createCtx({});
  const b = createCtx({});
  const observed = {
    env: process.env.KEEL_TEST ?? null,
    mode: probe(a).mode,
    simClock: "advance" in a.clock,
    now: a.clock.now(),
    simNet: "route" in a.net,
    uuids: [a.random.uuid(), a.random.uuid(), a.random.uuid()],
    again: [b.random.uuid(), b.random.uuid(), b.random.uuid()],
    floats: [a.random.float(), a.random.float()],
  };
  writeFileSync(new URL("./observed.json", import.meta.url), JSON.stringify(observed));
  expect(observed.mode).toBe("sim");
  expect(observed.again).toEqual(observed.uuids);
});
`;

type Observed = {
  env: string | null;
  mode: string;
  simClock: boolean;
  now: number;
  simNet: boolean;
  uuids: string[];
  again: string[];
  floats: number[];
};

const isObserved = (v: unknown): v is Observed =>
  typeof v === "object" && v !== null && "mode" in v && "uuids" in v && Array.isArray(v.uuids);

let dir = "";
const read = (): Observed => {
  const v: unknown = JSON.parse(readFileSync(join(dir, "test", "observed.json"), "utf8"));
  if (!isObserved(v)) throw new Error("observed.json has no mode");
  return v;
};

let viaKeel: Run | undefined;
let keelSaw: Observed | undefined;
let controlStatus: number | null = null;
let controlSaw: Observed | undefined;

beforeAll(() => {
  dir = makeProject("test-sim", { "test/sim.test.ts": PROBE_TEST });
  viaKeel = keel(dir, ["test"]);
  keelSaw = read();
  removeFile(dir, "test/observed.json");
  controlStatus = plainVitest(dir).status;
  controlSaw = read();
}, 180_000);

afterAll(() => {
  removeProject(dir);
});

const sim0 = (): { uuids: string[]; floats: number[] } => {
  const c = createCtx({ mode: "sim", seed: 0 });
  return { uuids: [c.random.uuid(), c.random.uuid(), c.random.uuid()], floats: [c.random.float(), c.random.float()] };
};

describe("k.ctx: `keel test` runs under sim by default", () => {
  it("`keel test` runs the project's test and it passes: one test, none failed, exit 0", () => {
    expect(viaKeel?.status).toBe(0);
    expect(summaryOf(viaKeel ?? { status: null, records: [], stdout: "" })).toMatchObject({
      kind: "summary",
      ok: true,
      counts: { tests: 1, failed: 0 },
    });
  });

  it("under `keel test` a ctx created with no options is sim: registered capability, clock and net", () => {
    expect(keelSaw).toMatchObject({ env: "1", mode: "sim", simClock: true, now: 0, simNet: true });
  });

  it("under `keel test` randomness is seeded: two default ctxs agree and equal a sim ctx with seed 0", () => {
    const want = sim0();
    expect(keelSaw?.uuids).toEqual(want.uuids);
    expect(keelSaw?.again).toEqual(want.uuids);
    expect(keelSaw?.floats).toEqual(want.floats);
  });

  it("control: the same project under plain vitest (no `keel test`) is real, unseeded, and its test fails", () => {
    expect(controlStatus).not.toBe(0);
    expect(controlSaw).toMatchObject({ env: null, mode: "real", simClock: false, simNet: false });
    expect(controlSaw?.uuids).not.toEqual(sim0().uuids);
    expect(controlSaw?.again).not.toEqual(controlSaw?.uuids);
  });
});
