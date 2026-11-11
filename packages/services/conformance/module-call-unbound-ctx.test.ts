// Spec: k.services Conformance, "On an unbound sim ctx, `service({ module: 'b' })` sends its request to `http://b.keel.invalid` plus the endpoint path."
// Seed 1337 (fc.assert below). `module` is not in `ServiceOptions` yet, so the service is built through Reflect.apply.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

describe("k.services: module calls", () => {
  test("On an unbound sim ctx, `service({ module: 'b' })` sends its request to `http://b.keel.invalid` plus the endpoint path.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,8}$/), async (id) => {
        const schema = endpoints({
          get: { method: "GET", path: "/b/:id", params: s.object({ id: s.string() }), output: s.json() },
        });
        const api: unknown = Reflect.apply(service, undefined, [{ module: "b", schema }]);
        const get: unknown = typeof api === "object" && api !== null ? Reflect.get(api, "get") : undefined;
        if (typeof get !== "function") throw new Error("client has no get");
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const urls: string[] = [];
        ctx.net.route("*", (req) => {
          urls.push(req.url);
          return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
        });
        await Reflect.apply(get, api, [{ params: { id } }, ctx]);
        expect(urls).toEqual([`http://b.keel.invalid/b/${id}`]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
