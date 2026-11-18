// Spec: std.shells, Conformance "With each package, a response whose body the native side sends in two chunks resolves before the second is sent and its body yields the first; aborting it cancels the native request; no `set-cookie` header reaches the page."
// Same clause as packages/std-capacitor/conformance/stream.test.ts.
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: the native side is the `plugin:http` stand-in of fixtures.ts under `mockIPC`, which sends one chunk of a reply's `chunks` for each `fetch_read_body` and sends it when the iterator yields it, held back by a gate the test opens;
// "cancels the native request" is a `fetch_cancel` or `fetch_cancel_body` command reaching the native side. The stand-in's reply carries its `set-cookie` header as the native client's does.
import { tauriDrivers } from "@keel/std-tauri";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { begin, end, ORIGIN, PAGES } from "./fixtures.ts";

const run = { seed: 1337, numRuns: 25 };
const chars = fc
  .array(fc.constantFrom(..."abcdefgh0123456789"), { minLength: 1, maxLength: 12 })
  .map((c) => c.join(""));

/** Two chunks, the second held back until `release()`; `sent` lists the chunks the native side has sent. */
function gated(first: string, second: string) {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const sent: string[] = [];
  async function* chunks(): AsyncGenerator<string> {
    sent.push(first);
    yield first;
    await gate;
    sent.push(second);
    yield second;
  }
  return { chunks: chunks(), sent, release: () => open() };
}

describe("std.shells: a response streams and can be cancelled", () => {
  afterEach(end);

  test("a response whose body the native side sends in two chunks resolves before the second is sent and its body yields the first", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, first, second) => {
        const world = begin(page);
        const native = gated(first, second);
        world.backend(() => ({ status: 200, headers: { "content-type": "text/event-stream" }, chunks: native.chunks }));
        const { net } = tauriDrivers({ origin: ORIGIN });
        const res = await net.fetch(new Request(`${ORIGIN.origin}/events`));
        expect(res.status).toBe(200);
        expect(native.sent).not.toContain(second);
        if (res.body === null) throw new Error("the response has no body");
        const reader = res.body.getReader();
        const head = await reader.read();
        expect(head.done).toBe(false);
        expect(new TextDecoder().decode(head.value)).toBe(first);
        expect(native.sent).toEqual([first]);
        native.release();
        let rest = "";
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          rest += new TextDecoder().decode(part.value);
        }
        expect(rest).toBe(second);
        end();
      }),
      run,
    );
  });

  test("aborting a streaming response cancels the native request", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, async (page, first, second) => {
        const world = begin(page);
        const native = gated(first, second);
        world.backend(() => ({ status: 200, headers: { "content-type": "text/event-stream" }, chunks: native.chunks }));
        const { net } = tauriDrivers({ origin: ORIGIN });
        const abort = new AbortController();
        const res = await net.fetch(new Request(`${ORIGIN.origin}/events`, { signal: abort.signal }));
        if (res.body === null) throw new Error("the response has no body");
        const reader = res.body.getReader();
        await reader.read();
        expect(world.cancelled).toEqual([]);
        abort.abort();
        await vi.waitFor(() => expect(world.cancelled.length).toBeGreaterThan(0));
        native.release();
        end();
      }),
      run,
    );
  });

  test("no `set-cookie` header of a streaming response reaches the page", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PAGES), chars, chars, chars, async (page, first, second, value) => {
        const world = begin(page);
        const native = gated(first, second);
        world.backend(() => ({
          status: 200,
          headers: { "content-type": "text/event-stream", "set-cookie": `sid=${value}; Path=/` },
          chunks: native.chunks,
        }));
        const { net } = tauriDrivers({ origin: ORIGIN });
        const res = await net.fetch(new Request(`${ORIGIN.origin}/events`));
        expect(res.headers.get("set-cookie")).toBeNull();
        expect([...res.headers.keys()]).not.toContain("set-cookie");
        expect(res.headers.getSetCookie()).toEqual([]);
        expect(document.cookie).toBe("");
        expect(world.jar.get(ORIGIN.origin)?.get("sid")).toBe(value);
        native.release();
        end();
      }),
      run,
    );
  });
});
