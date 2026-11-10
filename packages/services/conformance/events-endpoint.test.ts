// Spec: k.services Conformance, "An `events` endpoint against a live loader yielding `ok(1)` then `ok(2)` iterates exactly those, then ends; a `data:` line failing `output` yields one `api.decode` and ends; an aborted `signal` ends it with no further request."
// Seed 1337 (fc.assert below). No wall time: the stream is a sim net route; `events` is not in `Endpoint` yet, so the schema is built from a plain object.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const BASE = "https://api.example.com";
const Out = s.object({ n: s.int() });

const enc = new TextEncoder();
const sse = (lines: string[], hold?: AbortSignal): Response => {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const l of lines) c.enqueue(enc.encode(`${l}\n\n`));
      if (hold === undefined) c.close();
      else hold.addEventListener("abort", () => c.close());
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
};

const isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
  typeof v === "object" && v !== null && Symbol.asyncIterator in v;

const watch = () => {
  const def = { watch: { method: "GET", path: "/watch", output: Out, events: true } };
  const client: unknown = Reflect.apply(service, undefined, [
    { base: BASE, schema: Reflect.apply(endpoints, undefined, [def]) },
  ]);
  return (input: Record<string, unknown>, ctx: unknown): AsyncIterable<unknown> => {
    const fn: unknown = typeof client === "object" && client !== null ? Reflect.get(client, "watch") : undefined;
    if (typeof fn !== "function") throw new Error("client has no watch");
    const it: unknown = Reflect.apply(fn, client, [input, ctx]);
    if (typeof it !== "object" || it === null || !(Symbol.asyncIterator in it))
      throw new Error("watch is not async iterable");
    return it as AsyncIterable<unknown>;
  };
};

const collect = async (it: AsyncIterable<unknown>): Promise<unknown[]> => {
  const out: unknown[] = [];
  for await (const r of it) out.push(r);
  return out;
};

describe("k.services: events endpoints", () => {
  test.skip("An `events` endpoint against a live loader yielding `ok(1)` then `ok(2)` iterates exactly those, then ends; a `data:` line failing `output` yields one `api.decode` and ends; an aborted `signal` ends it with no further request.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.integer(), async (a, b) => {
        const read = watch();

        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const accepts: (string | null)[] = [];
        ctx.net.route(`${BASE}/watch`, (req) => {
          accepts.push(req.headers.get("accept"));
          return sse([
            `data: ${JSON.stringify({ ok: true, value: { n: a } })}`,
            `data: ${JSON.stringify({ ok: true, value: { n: b } })}`,
          ]);
        });
        const got = await collect(read({}, ctx));
        expect(got).toEqual([
          { ok: true, value: { n: a } },
          { ok: true, value: { n: b } },
        ]);
        expect(accepts).toEqual(["text/event-stream"]);

        const bad = createCtx({ mode: "sim", seed: 1337 });
        let calls = 0;
        bad.net.route(`${BASE}/watch`, () => {
          calls++;
          return sse([
            `data: ${JSON.stringify({ ok: true, value: { n: "x" } })}`,
            `data: ${JSON.stringify({ ok: true, value: { n: a } })}`,
          ]);
        });
        const failed = await collect(read({}, bad));
        expect(failed).toHaveLength(1);
        expect(JSON.stringify(failed[0])).toContain("api.decode");
        expect(calls).toBe(1);

        const live = createCtx({ mode: "sim", seed: 1337 });
        const ac = new AbortController();
        let opens = 0;
        live.net.route(`${BASE}/watch`, (req) => {
          opens++;
          return sse([`data: ${JSON.stringify({ ok: true, value: { n: a } })}`], req.signal);
        });
        const seen: unknown[] = [];
        for await (const r of read({ signal: ac.signal }, live)) {
          seen.push(r);
          ac.abort();
        }
        expect(seen).toHaveLength(1);
        expect(opens).toBe(1);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  test.skip("An `events` endpoint never reconnects or resumes: a stream that ends, or a `data:` line that is an `err`, ends the iteration after one request.", async () => {
    const read = watch();
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    let opens = 0;
    ctx.net.route(`${BASE}/watch`, () => {
      opens++;
      return sse([
        `data: ${JSON.stringify({ ok: false, error: { code: "x.boom", message: "m", data: {} } })}`,
        `data: ${JSON.stringify({ ok: true, value: { n: 1 } })}`,
      ]);
    });
    const got = await collect(read({}, ctx));
    expect(got).toHaveLength(1);
    expect(JSON.stringify(got[0])).toContain("api.status");
    expect(opens).toBe(1);
  });
});
