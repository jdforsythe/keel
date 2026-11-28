// @vitest-environment happy-dom
// Spec: k.sim, clause "A scenario that fails only when a response is `lost` fails `simulate` with E1704 whose shrunk `SimRun` holds exactly one `lost` step and no other fault; `replay` of it fails the same way."
// k.sim, simulate "The seed is `seed`, else `KEEL_SEED`, else 1337; success resolves `{ seed, runs, checked }` (k.drive-law)."
// Seed: 1337.
import { simulate } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, isRecord, messageOf, thrown } from "./fixtures.ts";

const URL_BASE = "https://sim.example.test/item";

// Fails only when a response is lost: the route ran for a request whose fetch then rejected.
const failsOnLost: Parameters<typeof simulate>[0] = async ({ ctx, run }) => {
  const ran = new Set<string>();
  ctx.net.route(`${URL_BASE}*`, (req) => {
    ran.add(new URL(req.url).search);
    return new Response("ok");
  });
  const outcomes = [0, 1, 2, 3, 4, 5].map((i) =>
    ctx.net.fetch(new Request(`${URL_BASE}?i=${i}`)).then(
      () => ({ i, rejected: false }),
      () => ({ i, rejected: true }),
    ),
  );
  await run();
  for (const o of await Promise.all(outcomes)) {
    if (o.rejected && ran.has(`?i=${o.i}`)) throw new Error(`response ${o.i} was lost`);
  }
};

// The shrunk SimRun is the JSON on the line after the first line of the message.
function shrunkRun(e: unknown): unknown {
  const lines = messageOf(e).split("\n");
  const line = lines[1];
  if (line === undefined) throw new Error("E1704 message has no second line");
  return JSON.parse(line);
}

const faultsOf = (run: unknown): string[] => {
  if (!isRecord(run) || !isRecord(run.schedule) || !Array.isArray(run.schedule.net)) throw new Error("not a SimRun");
  return run.schedule.net.flatMap((step: unknown) =>
    isRecord(step) && typeof step.fault === "string" && step.fault !== "none" ? [step.fault] : [],
  );
};

describe("k.sim: shrinking", () => {
  it("a scenario that fails only when a response is `lost` fails `simulate` with E1704", async () => {
    const e = await thrown(() => simulate(failsOnLost, { runs: 200, seed: SEED }));
    expect(codeOf(e)).toBe("E1704");
    expect(messageOf(e)).toContain(`seed ${SEED}`);
  });

  it("the shrunk `SimRun` holds exactly one `lost` step and no other fault", async () => {
    const e = await thrown(() => simulate(failsOnLost, { runs: 200, seed: SEED }));
    const run = shrunkRun(e);
    expect(faultsOf(run)).toEqual(["lost"]);
    if (!isRecord(run) || !isRecord(run.schedule)) throw new Error("not a SimRun");
    expect(run.schedule.storage).not.toContain("fail");
    expect(run.schedule.offline).toEqual([]);
  });

  it("`replay` of the shrunk `SimRun` fails the same way", async () => {
    const first = await thrown(() => simulate(failsOnLost, { runs: 200, seed: SEED }));
    const replayed = await thrown(() => simulate(failsOnLost, { replay: shrunkRun(first) }));
    expect(codeOf(replayed)).toBe("E1704");
    expect(faultsOf(shrunkRun(replayed))).toEqual(["lost"]);
  });

  it("a scenario that never fails resolves `{ seed, runs, checked }`, `checked` 0 with `law` off", async () => {
    const r = await simulate(async ({ run }) => run(), { runs: 20, seed: SEED, law: false });
    expect(r).toEqual({ seed: SEED, runs: 20, checked: 0 });
  });
});
