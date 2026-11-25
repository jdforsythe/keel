// Spec: k.services, clause "An `events` endpoint against a live loader yielding `ok(1)` then `ok(2)` iterates exactly those, then ends; a `data:` line failing `output` yields one `api.decode` and ends; an aborted `signal` ends it with no further request."
// RFC 0157 Conformance diff: "An `events: true` entry bound to a loader whose `fn` is not an async generator throws E1515; with one, the client iterates its yields." Seed 1337 (fc.assert below).
// The server half is a sim net route streaming `data:` lines; the entry is `events: true` of a contract.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const Out = s.object({ n: s.int() });
const c = contract("b", { "b.watch": { method: "GET", path: "/watch", output: Out, events: true } });
const enc = new TextEncoder();
const sse = (lines: string[]): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(ctl) {
        for (const l of lines) ctl.enqueue(enc.encode(`${l}\n\n`));
        ctl.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const r of it) out.push(r);
  return out;
};

describe("k.contract events entry client", () => {
  test("a client of an `events: true` entry iterates the stream's yields in order, then ends", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const accepts: (string | null)[] = [];
        ctx.net.route("http://b.keel.invalid/watch", (req) => {
          accepts.push(req.headers.get("accept"));
          return sse([
            `data: ${JSON.stringify({ ok: true, value: { n: a } })}`,
            `data: ${JSON.stringify({ ok: true, value: { n: b } })}`,
          ]);
        });
        const got = await collect(service({ contract: c }).watch({}, ctx));
        expect(got.map((r) => (r.ok ? r.value.n : null))).toEqual([a, b]);
        expect(accepts).toEqual(["text/event-stream"]);
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  test("a `data:` line failing `output` yields one `api.decode` and ends", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route("http://b.keel.invalid/watch", () =>
      sse([
        `data: ${JSON.stringify({ ok: true, value: { n: "x" } })}`,
        `data: ${JSON.stringify({ ok: true, value: { n: 2 } })}`,
      ]),
    );
    const got = await collect(service({ contract: c }).watch({}, ctx));
    expect(got).toHaveLength(1);
    const first = got[0];
    expect(first?.ok).toBe(false);
    if (first !== undefined && !first.ok) expect(first.error.code).toBe("api.decode");
  });
});
