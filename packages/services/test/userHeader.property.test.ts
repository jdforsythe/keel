// @vitest-environment node
// A module call's `user` (k.user Across deployables, User header): signed by the signer a `createApp` binds under
// `"keel.user"` for the module, method, URL and body as sent, sent as `x-keel-user`; with no signer, a `user` that is
// not a string, or one the signer refuses, `api.input` at `user` and nothing sent. Seed 1337.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MODULES_KEY } from "../src/internal/MODULES_KEY.ts";
import { service } from "../src/service.ts";

const c = contract("b", {
  "b.get": { method: "GET", path: "/b/:n", params: s.object({ n: s.string() }), output: s.json() },
  "b.put": {
    method: "POST",
    path: "/b/:n",
    params: s.object({ n: s.string() }),
    body: s.object({ v: s.json() }),
    output: s.json(),
  },
});
const decoder = new TextDecoder();

function bound(withSigner: boolean) {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const sent: Request[] = [];
  ctx.net.route("*", (req) => {
    sent.push(req);
    return Response.json({ ok: true, value: {} });
  });
  const found: unknown = Reflect.get(globalThis, MODULES_KEY);
  const table = found instanceof WeakMap ? found : new WeakMap<object, Map<string, unknown>>();
  Reflect.set(globalThis, MODULES_KEY, table);
  const map = new Map<string, unknown>([["b", "http://b.test"]]);
  if (withSigner)
    map.set("keel.user", (module: string, method: string, url: string, user: string, body: string | Uint8Array) =>
      user.length > 8
        ? undefined
        : `${module} ${method} ${url} [${user}] |${typeof body === "string" ? body : decoder.decode(body)}`,
    );
  table.set(ctx, map);
  return { ctx, sent };
}

describe("service({ contract }) user", () => {
  test("a string `user` is sent as the signer's `x-keel-user` for that method and URL; no `user`, no header", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{0,8}$/), fc.json(), async (user, json) => {
        const { ctx, sent } = bound(true);
        const api = service({ contract: c });
        await api.get({ params: { n: "1" }, user }, ctx);
        await api.get({ params: { n: "2" } }, ctx);
        await api.put({ params: { n: "3" }, body: { v: JSON.parse(json) }, user }, ctx);
        const bodies = await Promise.all(sent.map((r) => r.text()));
        expect(sent.map((r) => r.headers.get("x-keel-user"))).toEqual([
          `b GET http://b.test/b/1 [${user}] |`,
          null,
          `b POST http://b.test/b/3 [${user}] |${bodies[2]}`,
        ]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("without a signer, with a `user` that is not a string, or one the signer refuses, the call is `api.input` at `user` and sends nothing", async () => {
    const cases: [boolean, unknown, string][] = [
      [false, "u1", "type"],
      [true, 42, "type"],
      [true, "u".repeat(9), "max"],
    ];
    for (const [withSigner, user, rule] of cases) {
      const { ctx, sent } = bound(withSigner);
      const r: unknown = await Reflect.apply(service({ contract: c }).get, undefined, [
        { params: { n: "1" }, user },
        ctx,
      ]);
      expect(r).toMatchObject({
        ok: false,
        error: { code: "api.input", data: { issues: [{ path: ["user"], rule }] } },
      });
      expect(sent).toEqual([]);
    }
  });
});
