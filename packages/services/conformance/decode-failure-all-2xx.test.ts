import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
// seed 1337 (fast-check runs below pass { seed: 1337 }); no wall clock, no Math.random.
const BASE = "https://api.example.com";
const Item = s.object({ n: s.int() });
const api = service({ base: BASE, schema: endpoints({ get: { method: "GET", path: "/items", output: Item } }) });
const notJson = (t: string): boolean => {
  try {
    JSON.parse(t);
    return false;
  } catch {
    return true;
  }
};

const decodeFails = async (status: number, body: string): Promise<void> => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route(`${BASE}/items`, async () => new Response(body, { status }));
  const r = await api.get({}, ctx);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.error.code).toBe("api.decode");
    expect(Array.isArray(r.error.data.issues)).toBe(true);
  }
};

describe("k.services: 2xx failing output yields api.decode for every 2xx and non-JSON bodies", () => {
  it("A 2xx response of any status (not only 200) whose body fails `output` yields `err` with `api.decode`, never `ok`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200, max: 299 }).filter((n) => n !== 204 && n !== 205),
        fc.string(),
        async (status, bad) => decodeFails(status, JSON.stringify({ n: bad })),
      ),
      { seed: 1337 },
    );
  });

  it("A 2xx response whose body is not JSON yields `err` with `api.decode`, never `ok`", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200, max: 299 }).filter((n) => n !== 204 && n !== 205),
        fc.string().filter(notJson),
        async (status, text) => decodeFails(status, text),
      ),
      { seed: 1337 },
    );
  });

  it("A 2xx response with an empty body yields `err` with `api.decode`", async () => {
    await decodeFails(200, "");
  });
});
