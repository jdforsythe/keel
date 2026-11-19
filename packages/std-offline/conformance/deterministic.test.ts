// Spec: std.offline, clause "Under one seed, two runs of one script of sends and connectivity changes give byte-equal outbox and server logs."
// Seed 1337
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, TODOS, createServer, edit, makeClient, settle, simCtx, startDrain, tick } from "./fixtures.ts";

type Step = { send: string; todo: (typeof TODOS)[number] } | { online: boolean } | { advance: number };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc
    .tuple(fc.string({ minLength: 1, maxLength: 6 }), fc.constantFrom(...TODOS))
    .map(([title, todo]): Step => ({ send: title, todo })),
  fc.boolean().map((online): Step => ({ online })),
  fc.integer({ min: 1, max: 70_000 }).map((advance): Step => ({ advance })),
);

async function run(script: readonly Step[]): Promise<string> {
  const ctx = simCtx(1337);
  const server = createServer();
  server.attach(ctx);
  const c = makeClient({ id: "det.outbox" });
  const stop = startDrain(ctx, c.o);
  await settle();
  for (const step of script) {
    if ("send" in step) await send(ctx, c.o, ORIGIN, "editTodo", edit(step.todo, step.send), { base: server.head() });
    else if ("online" in step) ctx.net.setOnline(step.online);
    else await tick(ctx, step.advance);
    await settle();
  }
  const out = JSON.stringify({ outbox: c.o.log(), server: server.log() });
  stop();
  c.dispose();
  return out;
}

test("Under one seed, two runs of one script of sends and connectivity changes give byte-equal outbox and server logs.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 10 }), async (script) => {
      expect(await run(script)).toBe(await run(script));
    }),
    { seed: 1337, numRuns: 12 },
  );
});
