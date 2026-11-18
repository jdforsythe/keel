// @vitest-environment node
// A module call's `user` (k.user Across deployables): signed by the signer a `createApp` binds under `"keel.user"`,
// sent as `x-keel-user`; with no signer, or a `user` that is not a string, `api.input` at `user` and nothing sent. Seed 1337.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { MODULES_KEY } from "../src/internal/MODULES_KEY.ts";
import { service } from "../src/service.ts";

const schema = endpoints({
  get: { method: "GET", path: "/b/:n", params: s.object({ n: s.string() }), output: s.json() },
});

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
  if (withSigner) map.set("keel.user", (method: string, url: string, user: string) => `${method} ${url} [${user}]`);
  table.set(ctx, map);
  return { ctx, sent };
}

describe("service({ module }) user", () => {
  test("a string `user` is sent as the signer's `x-keel-user` for that method and URL; no `user`, no header", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{0,20}$/), async (user) => {
        const { ctx, sent } = bound(true);
        const api = service({ module: "b", schema });
        await api.get({ params: { n: "1" }, user }, ctx);
        await api.get({ params: { n: "2" } }, ctx);
        expect(sent.map((r) => r.headers.get("x-keel-user"))).toEqual([`GET http://b.test/b/1 [${user}]`, null]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("without a signer, or with a `user` that is not a string, the call is `api.input` at `user` and sends nothing", async () => {
    const cases: [boolean, unknown][] = [
      [false, "u1"],
      [true, 42],
    ];
    for (const [withSigner, user] of cases) {
      const { ctx, sent } = bound(withSigner);
      const r: unknown = await Reflect.apply(service({ module: "b", schema }).get, undefined, [
        { params: { n: "1" }, user },
        ctx,
      ]);
      expect(r).toMatchObject({ ok: false, error: { code: "api.input", data: { issues: [{ path: ["user"] }] } } });
      expect(sent).toEqual([]);
    }
  });
});
