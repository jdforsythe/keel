// Spec: k.services, Conformance "With `maxBytes: 64`, an `events` endpoint of `output` `s.json()` served the body `data: {"ok":true,"value":1}`, two line feeds, `data: {"ok":true,"value":"<s>"}`, two line feeds, yields `ok(1)` and then `ok(s)` for `s` of 34 `a` (a 64-byte block), and `ok(1)` and then one `api.decode` with issues `[{ path: [], rule: 'max' }]`, then ends with the body cancelled, for 35 `a`; one served `data: {"ok":true,"value":1}`, two line feeds, then 17 lines `: x`, each with its line feed, and no blank line yields `ok(1)` and then that `api.decode`; one served 20 blocks of `: x` and two line feeds (5 bytes each), then `data: {"ok":true,"value":1}` and two line feeds, yields `ok(1)`."
// Spec: k.services, API "A GET endpoint with `events: true` is an event stream (a k.server live loader): its method returns an `AsyncIterable` of `Result<T, ApiError>`, sends `accept: text/event-stream` and decodes each `data:` line, a k.server `Result`: an `ok` value with `output`, an `err` as `api.status` (200, `body` the error). It ends when the stream ends, after an `err`, or when `signal` aborts; it never reconnects or resumes. Its timeout applies until the response starts. One event is at most `maxBytes`: its bytes from the one after the blank line that ends the line block before it (or the body's start) through the blank line that ends it, every line, comment and line end counted. Once a block passes `maxBytes` before its blank line comes, the body is cancelled and the iteration yields one `api.decode` (issues `[{ path: [], rule: 'max' }]`) and ends. The body is read in steps linear in its bytes."
// Seed 1337 (fc.assert below). No wall time: the stream is a sim net route, cut into chunks at generated sizes.
// Reading in steps linear in a body's bytes (a long line costs no quadratic time) states a cost, not a result a test can read without a clock: untestable here.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const c = contract("b", { "b.watch": { method: "GET", path: "/watch", output: s.json(), events: true } });
const enc = new TextEncoder();

interface Served {
  readonly cancelled: () => boolean;
  readonly pulls: () => number;
  readonly response: Response;
}
/**
 * A 2xx event stream of `body`, cut into chunks of the given sizes (the rest in one more chunk). With `open`, the source never
 * ends after its bytes (its pull then waits for ever), so only a cancel by the reader can stop the read; without it, it closes.
 */
function served(body: string, sizes: readonly number[] = [], open = false): Served {
  const bytes = enc.encode(body);
  let at = 0;
  let cancelled = false;
  let pulls = 0;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(ctl) {
        pulls += 1;
        if (at >= bytes.length) {
          if (open) return new Promise<void>(() => undefined);
          ctl.close();
          return undefined;
        }
        const take = sizes.length > 0 ? (sizes[(at + bytes.length) % sizes.length] ?? bytes.length) : bytes.length;
        ctl.enqueue(bytes.slice(at, at + take));
        at += take;
        return undefined;
      },
      cancel() {
        cancelled = true;
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
  return { cancelled: () => cancelled, pulls: () => pulls, response };
}
async function read(maxBytes: number, body: string, sizes?: readonly number[], open = false) {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const stream = served(body, sizes, open);
  ctx.net.route("http://b.keel.invalid/watch", () => stream.response);
  const got: Array<{ ok: true; value: unknown } | { ok: false; code: string; data: unknown }> = [];
  for await (const r of service({ contract: c, maxBytes }).watch({}, ctx)) {
    if (r.ok) got.push({ ok: true, value: r.value });
    else got.push({ ok: false, code: r.error.code, data: Reflect.get(r.error, "data") });
  }
  return { got, cancelled: stream.cancelled(), pulls: stream.pulls() };
}
const one = 'data: {"ok":true,"value":1}\n\n';
const event = (value: string): string => `data: {"ok":true,"value":"${value}"}\n\n`;
const maxIssue = { issues: [{ path: [], rule: "max" }] };
const sizesArb = fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 0, maxLength: 5 });

describe("k.services: one event is at most `maxBytes`", () => {
  it('With `maxBytes: 64`, an `events` endpoint of `output` `s.json()` served `data: {"ok":true,"value":1}`, two line feeds, `data: {"ok":true,"value":"<s>"}`, two line feeds, yields `ok(1)` and then `ok(s)` for `s` of 34 `a` (a 64-byte block).', async () => {
    const s34 = "a".repeat(34);
    expect(enc.encode(event(s34))).toHaveLength(64);
    await fc.assert(
      fc.asyncProperty(sizesArb, async (sizes) => {
        const { got } = await read(64, one + event(s34), sizes);
        expect(got).toEqual([
          { ok: true, value: 1 },
          { ok: true, value: s34 },
        ]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("The same body with `s` of 35 `a` yields `ok(1)` and then one `api.decode` with issues `[{ path: [], rule: 'max' }]`, then ends with the body cancelled.", async () => {
    await fc.assert(
      fc.asyncProperty(sizesArb, async (sizes) => {
        const { got, cancelled } = await read(64, one + event("a".repeat(35)), sizes, true);
        expect(got).toHaveLength(2);
        expect(got[0]).toEqual({ ok: true, value: 1 });
        expect(got[1]).toMatchObject({ ok: false, code: "api.decode", data: maxIssue });
        expect(cancelled).toBe(true);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it('One served `data: {"ok":true,"value":1}`, two line feeds, then 17 lines `: x`, each with its line feed, and no blank line yields `ok(1)` and then that `api.decode`.', async () => {
    await fc.assert(
      fc.asyncProperty(sizesArb, async (sizes) => {
        const { got, cancelled } = await read(64, one + ": x\n".repeat(17), sizes, true);
        expect(got).toHaveLength(2);
        expect(got[0]).toEqual({ ok: true, value: 1 });
        expect(got[1]).toMatchObject({ ok: false, code: "api.decode", data: maxIssue });
        expect(cancelled).toBe(true);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it('One served 20 blocks of `: x` and two line feeds (5 bytes each), then `data: {"ok":true,"value":1}` and two line feeds, yields `ok(1)`.', async () => {
    await fc.assert(
      fc.asyncProperty(sizesArb, async (sizes) => {
        const { got } = await read(64, ": x\n\n".repeat(20) + one, sizes);
        expect(got).toEqual([{ ok: true, value: 1 }]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("For any `maxBytes`, a block of exactly that many bytes is read and one byte more is `api.decode` with `rule: 'max'`, whatever the chunking.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 40, max: 600 }), sizesArb, async (max, sizes) => {
        const fits = await read(max, event("a".repeat(max - 30)), sizes);
        expect(fits.got).toEqual([{ ok: true, value: "a".repeat(max - 30) }]);
        const over = await read(max, event("a".repeat(max - 29)), sizes, true);
        expect(over.got).toHaveLength(1);
        expect(over.got[0]).toMatchObject({ ok: false, code: "api.decode", data: maxIssue });
        expect(over.cancelled).toBe(true);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("A heartbeat (`:` and two line feeds) is its own block: any number of them before an event add nothing to that event's block.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 200 }), sizesArb, async (n, sizes) => {
        const { got } = await read(64, ":\n\n".repeat(n) + one, sizes);
        expect(got).toEqual([{ ok: true, value: 1 }]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("Every line, comment and line end counts: a block of a comment line and a data line, 64 bytes with both line ends, is read, and 65 is `api.decode`.", async () => {
    const comment = ": hello\n";
    const fits = `${comment}data: {"ok":true,"value":"${"a".repeat(64 - 30 - comment.length)}"}\n\n`;
    expect(enc.encode(fits)).toHaveLength(64);
    const ok = await read(64, fits);
    expect(ok.got).toHaveLength(1);
    expect(ok.got[0]).toMatchObject({ ok: true });
    const over = await read(64, fits.replace('"}', 'a"}'));
    expect(over.got).toHaveLength(1);
    expect(over.got[0]).toMatchObject({ ok: false, code: "api.decode", data: maxIssue });
  });

  it("A block counts bytes of UTF-8, not characters: a value of `é` whose block is 64 bytes is read, and one `é` more is `api.decode`.", async () => {
    const fits = event("é".repeat(17));
    expect(enc.encode(fits)).toHaveLength(64);
    expect((await read(64, fits)).got).toEqual([{ ok: true, value: "é".repeat(17) }]);
    const over = await read(64, event("é".repeat(18)));
    expect(over.got[0]).toMatchObject({ ok: false, code: "api.decode" });
  });

  it("Once a block passes `maxBytes` before its blank line comes, the body is cancelled: a source of a long unfinished block, in 8-byte chunks, is cancelled and is not read on to its end.", async () => {
    const body = `data: ${"a".repeat(4000)}`;
    const { got, cancelled, pulls } = await read(64, body, [8], true);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ ok: false, code: "api.decode", data: maxIssue });
    expect(cancelled).toBe(true);
    // 4,006 bytes are 501 chunks; the cap passes in the 9th, and a stream may read one chunk ahead of its reader.
    expect(pulls).toBeLessThan(20);
  });
});
