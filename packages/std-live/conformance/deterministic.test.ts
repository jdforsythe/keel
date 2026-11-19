// Spec: std.live, clause "Under one seed, two runs of one script of saves give byte-equal logs on the hydrated store."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { createServer, mount, readBoard, settle, simCtx, tick } from "./fixtures.ts";

type Step = { save: string } | { advance: number } | { drop: true };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.string({ maxLength: 6 }).map((save): Step => ({ save })),
  fc.integer({ min: 1, max: 5000 }).map((advance): Step => ({ advance })),
  fc.constant<Step>({ drop: true }),
);

async function run(script: readonly Step[]): Promise<string> {
  const ctx = simCtx(1337);
  const server = createServer();
  server.attach(ctx);
  const m = mount(ctx, readBoard);
  await settle();
  for (const step of script) {
    if ("save" in step) server.save(step.save);
    else if ("advance" in step) await tick(ctx, step.advance);
    else server.drop();
    await settle();
  }
  const out = JSON.stringify(m.view.log());
  m.dispose();
  return out;
}

test("Under one seed, two runs of one script of saves give byte-equal logs on the hydrated store.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 10 }), async (script) => {
      const a = await run(script);
      const b = await run(script);
      expect(a).toBe(b);
      expect(JSON.parse(a).length).toBeGreaterThan(0);
    }),
    { seed: 1337, numRuns: 15 },
  );
});
