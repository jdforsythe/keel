// net.fetch over the native plugin: for any split of a body into chunks the stream yields the same bytes in order, and
// after the body ends, fails or is aborted no listener is left.
// @vitest-environment happy-dom
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { capacitorNet } from "../src/internal/capacitorNet.ts";
import { fakeKeelHttp } from "./fakeKeelHttp.ts";

vi.mock("@capacitor/core", async (original) => {
  const actual = await original<typeof import("@capacitor/core")>();
  const { fakeKeelHttp: f } = await import("./fakeKeelHttp.ts");
  return { ...actual, registerPlugin: () => f.plugin };
});

const run = { seed: 1337, numRuns: 100 };
const ORIGIN = new URL("https://golden-1.example");
/** The plugin answers within a few microtasks: poll each millisecond, not vitest's default 50 ms, which a run would wait out. */
const POLL = { interval: 1 };
const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64");

/** Waits until the request has been sent, then returns its `id`. */
async function sent(n: number): Promise<string> {
  await vi.waitFor(() => expect(fakeKeelHttp.ids.length).toBeGreaterThanOrEqual(n), POLL);
  return fakeKeelHttp.ids[n - 1] ?? "";
}

async function readAll(res: Response): Promise<Uint8Array> {
  return new Uint8Array(await res.arrayBuffer());
}

describe("capacitorNet over KeelHttp", () => {
  afterEach(() => fakeKeelHttp.reset());

  test("any split of a body into chunks yields the same bytes in order, and no listener is left after the end", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.uint8Array({ maxLength: 40 }), { maxLength: 8 }), async (parts) => {
        fakeKeelHttp.reset();
        const net = capacitorNet(ORIGIN);
        const pending = net.fetch(new Request(`${ORIGIN.origin}/x`));
        const id = await sent(1);
        expect(fakeKeelHttp.live()).toBe(3);
        fakeKeelHttp.head(id, { status: 200, headers: { "content-type": "text/plain" } });
        const res = await pending;
        const body = readAll(res);
        for (const p of parts) fakeKeelHttp.emit("chunk", { id, data: b64(p) });
        fakeKeelHttp.emit("end", { id });
        const all = Buffer.concat(parts.map((p) => Buffer.from(p)));
        expect(Buffer.from(await body).equals(all)).toBe(true);
        await vi.waitFor(() => expect(fakeKeelHttp.live()).toBe(0), POLL);
        expect(fakeKeelHttp.cancelled).toEqual([]);
      }),
      run,
    );
  });

  test("after a fail, an abort or a reader's cancel at any point of the body no listener is left", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
        fc.constantFrom("fail", "abort", "cancel"),
        async (parts, how) => {
          fakeKeelHttp.reset();
          const abort = new AbortController();
          const pending = capacitorNet(ORIGIN).fetch(new Request(`${ORIGIN.origin}/x`, { signal: abort.signal }));
          const id = await sent(1);
          fakeKeelHttp.head(id, { status: 200, headers: {} });
          const res = await pending;
          if (res.body === null) throw new Error("no body");
          const reader = res.body.getReader();
          for (const p of parts) {
            fakeKeelHttp.emit("chunk", { id, data: b64(p) });
            expect((await reader.read()).value).toEqual(p);
          }
          if (how === "fail") {
            fakeKeelHttp.emit("fail", { id, message: "reset" });
            await expect(reader.read()).rejects.toBeInstanceOf(TypeError);
          } else if (how === "abort") {
            abort.abort();
            await expect(reader.read()).rejects.toBe(abort.signal.reason);
          } else await reader.cancel();
          await vi.waitFor(() => expect(fakeKeelHttp.live()).toBe(0), POLL);
          expect(fakeKeelHttp.cancelled).toEqual(how === "fail" ? [] : [id]);
          fakeKeelHttp.emit("chunk", { id, data: b64(new Uint8Array([1])) });
          fakeKeelHttp.emit("end", { id });
        },
      ),
      run,
    );
  });
});
