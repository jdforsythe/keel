// Spec: k.fixes, clause "The chain `retry` ends in a project whose probe holds: answers 503, 503 and 200 give `ok` after three requests and waits of 100 and 200 sim ms; 404 gives `err` `feed.http` with data `{ status: 404 }` after one request; a refused connection on every try gives `err` `feed.unreachable` after `tries` requests; a defect raised while the body is read rejects with that defect after one request."
// Seed 1337. The fake `fetch` and clock are written here; no real time passes.
import { defect, isDefect } from "@keel/schema";
import { expect, test } from "vitest";
import { fetchRetry } from "./end/fetchRetry.ts";

type Ctx = Parameters<typeof fetchRetry>[0];

const body = JSON.stringify({ items: ["a"] });
const world = (answers: readonly (number | "refused" | "defect")[]) => {
  const calls: string[] = [];
  const waits: number[] = [];
  let n = 0;
  const ctx: Ctx = {
    net: {
      fetch: async (r) => {
        calls.push(r.url);
        const a = answers[Math.min(n++, answers.length - 1)];
        if (a === "refused") throw new TypeError("fetch failed");
        if (a === "defect") {
          const res = new Response("x");
          Object.defineProperty(res, "text", { value: () => Promise.reject(defect("body")) });
          return res;
        }
        return new Response(a === 200 ? body : "no", { status: a ?? 200 });
      },
    },
    clock: { after: async (ms) => void waits.push(ms) },
  };
  return { ctx, calls, waits };
};

test("answers 503, 503 and 200 give ok after three requests and waits of 100 and 200 sim ms", async () => {
  const w = world([503, 503, 200]);
  const r = await fetchRetry(w.ctx, "http://x/feed", 5);
  expect(r).toEqual({ ok: true, value: { items: ["a"] } });
  expect(w.calls).toHaveLength(3);
  expect(w.waits).toEqual([100, 200]);
});

test("404 gives err feed.http with data { status: 404 } after one request", async () => {
  const w = world([404]);
  const r = await fetchRetry(w.ctx, "http://x/feed", 5);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error.code).toBe("feed.http");
  expect(r.error.data).toEqual({ status: 404 });
  expect(w.calls).toHaveLength(1);
});

test("a refused connection on every try gives err feed.unreachable after `tries` requests", async () => {
  const w = world(["refused"]);
  const r = await fetchRetry(w.ctx, "http://x/feed", 4);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe("feed.unreachable");
  expect(w.calls).toHaveLength(4);
});

test("a defect raised while the body is read rejects with that defect after one request", async () => {
  const w = world(["defect"]);
  const got: unknown = await fetchRetry(w.ctx, "http://x/feed", 5).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(isDefect(got)).toBe(true);
  expect(w.calls).toHaveLength(1);
});
