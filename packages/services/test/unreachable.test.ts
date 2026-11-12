import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { endpoints, service } from "../src/index.ts";

const BASE = "https://api.example.com";
const api = service({
  base: BASE,
  schema: endpoints({
    get: { method: "GET", path: "/x", output: s.object({}), errors: { 502: s.object({ ok: s.boolean() }) } },
  }),
});

async function code(status: number, body: string): Promise<string | undefined> {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route(`${BASE}/x`, () => new Response(body, { status }));
  const r = await api.get({}, ctx);
  return r.ok ? undefined : r.error.code;
}

describe("502 keel.unreachable", () => {
  it("is api.network, even when 502 is a declared error", async () => {
    const body = JSON.stringify({ ok: false, error: { code: "keel.unreachable", message: "m", data: {} } });
    expect(await code(502, body)).toBe("api.network");
  });
  it("any other 502 stays api.status", async () => {
    const other = JSON.stringify({ ok: false, error: { code: "keel.unexpected", message: "m", data: {} } });
    expect(await code(502, other)).toBe("api.status");
    expect(await code(502, "not json")).toBe("api.status");
    expect(await code(502, "")).toBe("api.status");
  });
  it("a non-502 status with the code is not api.network", async () => {
    const body = JSON.stringify({ ok: false, error: { code: "keel.unreachable", message: "m", data: {} } });
    expect(await code(500, body)).toBe("api.status");
  });
});
