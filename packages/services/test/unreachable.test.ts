import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { endpoints, service } from "../src/index.ts";

const BASE = "https://api.example.com";
const MODULE_URL = "http://b.keel.invalid";
const get = {
  method: "GET",
  path: "/x",
  output: s.object({}),
  errors: { 502: s.object({ ok: s.boolean() }) },
} as const;
const schema = endpoints({ get });
const b = contract("b", { "b.get": get });
const api = service({ base: BASE, schema });
const peer = service({ contract: b });
const JSON_TYPE = { "content-type": "application/json" };
const unreachable = (message: string): string =>
  JSON.stringify({ ok: false, error: { code: "keel.unreachable", message, data: {} } });

type Answer = { status: number; body: string; headers?: Record<string, string> };

async function codeOf(client: typeof api, url: string, a: Answer): Promise<string | undefined> {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.net.route(url, () => new Response(a.body, { status: a.status, headers: a.headers ?? {} }));
  const r = await client.get({}, ctx);
  return r.ok ? undefined : r.error.code;
}
const viaModule = (a: Answer): Promise<string | undefined> => codeOf(peer, `${MODULE_URL}/x`, a);
const viaBase = (a: Answer): Promise<string | undefined> => codeOf(api, `${BASE}/x`, a);

describe("502 keel.unreachable", () => {
  it("is api.network for a module call, even when 502 is a declared error", async () => {
    expect(await viaModule({ status: 502, body: unreachable("m"), headers: JSON_TYPE })).toBe("api.network");
  });
  it("is api.status for a base call", async () => {
    expect(await viaBase({ status: 502, body: unreachable("m"), headers: JSON_TYPE })).toBe("api.status");
    expect(await viaBase({ status: 502, body: JSON.stringify({ ok: false }), headers: JSON_TYPE })).toBe("api.status");
  });
  it("any other 502 to a module stays api.status", async () => {
    const other = JSON.stringify({ ok: false, error: { code: "keel.unexpected", message: "m", data: {} } });
    expect(await viaModule({ status: 502, body: other, headers: JSON_TYPE })).toBe("api.status");
    expect(await viaModule({ status: 502, body: "not json", headers: JSON_TYPE })).toBe("api.status");
    expect(await viaModule({ status: 502, body: "", headers: JSON_TYPE })).toBe("api.status");
  });
  it("needs a JSON content-type", async () => {
    const headers = { "content-type": "text/plain" };
    expect(await viaModule({ status: 502, body: unreachable("m"), headers })).toBe("api.status");
  });
  it("a non-502 status with the code is not api.network", async () => {
    expect(await viaModule({ status: 500, body: unreachable("m"), headers: JSON_TYPE })).toBe("api.status");
  });
  it("a body of at most 1 KiB maps, a longer one does not", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 2048 }), async (extra) => {
        const body = unreachable("a".repeat(extra));
        const code = await viaModule({ status: 502, body, headers: JSON_TYPE });
        expect(code, `${body.length}`).toBe(body.length <= 1024 ? "api.network" : "api.status");
      }),
      { seed: 1337 },
    );
  });
  it("a declared content-length over 1,024 skips the read", async () => {
    const headers = { ...JSON_TYPE, "content-length": "2000" };
    expect(await viaModule({ status: 502, body: unreachable("m"), headers })).toBe("api.status");
  });
});
