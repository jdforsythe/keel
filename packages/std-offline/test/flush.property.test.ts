// Property: an outbox posts every generated script's entries in the order added, each key once, whatever the
// connectivity changes and lost requests between them. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, drain, outbox, send } from "../src/index.ts";

const ORIGIN = "http://app.keel.invalid";
const OWNER = "u1";
const Api = endpoints({
  add: {
    method: "POST",
    path: "/add",
    body: s.object({ n: s.int(), write: Write }),
    output: s.object({ n: s.int() }),
  },
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

type Step = { send: true } | { online: boolean } | { drop: true } | { advance: number };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constant<Step>({ send: true }),
  fc.boolean().map((online): Step => ({ online })),
  fc.constant<Step>({ drop: true }),
  fc.integer({ min: 1, max: 70_000 }).map((advance): Step => ({ advance })),
);

let n = 0;

async function run(script: readonly Step[]): Promise<{ added: string[]; applied: string[]; left: number }> {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const applied: string[] = [];
  const seen = new Set<string>();
  let drops = 0;
  ctx.net.route(`${ORIGIN}/add`, async (req) => {
    const body: unknown = await req.json();
    const write: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "write") : undefined;
    const key: unknown = typeof write === "object" && write !== null ? Reflect.get(write, "key") : undefined;
    if (typeof key !== "string") return new Response("{}", { status: 422 });
    if (!seen.has(key)) applied.push(key);
    seen.add(key);
    if (drops > 0) {
      drops--;
      throw new TypeError("response lost");
    }
    return new Response(JSON.stringify({ ok: true, value: { n: applied.length } }), {
      headers: { "content-type": "application/json" },
    });
  });
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(`prop${++n}.outbox`, Api, { module: "app" });
    if (held.o !== undefined) void drain(ctx, held.o, { owner: OWNER });
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  let sent = 0;
  for (const step of script) {
    if ("send" in step) void send(ctx, o, "add", { body: { n: sent++ } }, { base: 0, owner: OWNER });
    else if ("online" in step) ctx.net.setOnline(step.online);
    else if ("drop" in step) drops++;
    else ctx.clock.advance(step.advance);
    await settle();
  }
  drops = 0;
  ctx.net.setOnline(true);
  await settle();
  ctx.clock.advance(60_000);
  await settle();
  const left = o.get("entries").length;
  const added = o
    .log()
    .filter((e) => e.name === `${o.id}.add`)
    .map((e) => String(Reflect.get(Object(e.payload), "key")));
  sc.dispose();
  return { added, applied, left };
}

test("every entry is applied once, in the order added", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 14 }), async (script) => {
      const r = await run(script);
      expect(r.applied).toEqual(r.added);
      expect(r.left).toBe(0);
    }),
    { seed: 1337, numRuns: 60 },
  );
});
