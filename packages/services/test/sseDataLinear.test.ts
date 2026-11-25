import { describe, expect, it } from "vitest";
import { sseData } from "../src/internal/sseData.ts";

const enc = new TextEncoder();
async function run(chunks: readonly Uint8Array[], max: number) {
  const counted = { reads: 0 };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(ctl) {
      counted.reads++;
      const c = chunks[i++];
      if (c === undefined) ctl.close();
      else ctl.enqueue(c);
    },
  });
  const out: Array<string | null> = [];
  for await (const d of sseData(body, new AbortController().signal, max)) out.push(d);
  return out;
}

describe("sseData reads each byte once", () => {
  it("one long data line in many one-byte chunks is read whole, in time linear in its bytes", async () => {
    const text = `data: ${"x".repeat(200_000)}\n\n`;
    const bytes = enc.encode(text);
    const chunks = Array.from(bytes, (b) => Uint8Array.of(b));
    const t = performance.now();
    const out = await run(chunks, 1 << 20);
    expect(out).toEqual(["x".repeat(200_000)]);
    expect(performance.now() - t).toBeLessThan(5000);
  });
  it("a line over the cap is never held past it: null, then the end", async () => {
    const chunks = Array.from({ length: 1000 }, () => enc.encode("x".repeat(100)));
    expect(await run(chunks, 1000)).toEqual([null]);
  });
  it("CRLF line ends and a multi-byte character cut between chunks read as one", async () => {
    const bytes = enc.encode("data: é\r\ndata: b\r\n\r\n");
    const out = await run([bytes.slice(0, 7), bytes.slice(7, 8), bytes.slice(8)], 100);
    expect(out).toEqual(["é\nb"]);
  });
  it("cancels the body once a block passes the cap", async () => {
    let cancelled = false;
    const bytes = enc.encode("data: ".concat("x".repeat(100), "\n\n"));
    const body = new ReadableStream<Uint8Array>({
      pull(ctl) {
        ctl.enqueue(bytes);
      },
      cancel() {
        cancelled = true;
      },
    });
    const out: Array<string | null> = [];
    for await (const d of sseData(body, new AbortController().signal, 50)) out.push(d);
    expect(out).toEqual([null]);
    expect(cancelled).toBe(true);
  });
});
