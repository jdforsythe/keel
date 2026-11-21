// Spec: k.services Conformance, "On an unbound sim ctx, `service({ contract: b })` of module `b` sends its request to `http://b.keel.invalid` plus the entry's path."
// Seed 1337 (fc.assert below).
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const b = contract("b", {
  "b.get": { method: "GET", path: "/b/:id", params: s.object({ id: s.string() }), output: s.json() },
});

describe("k.services: contract calls", () => {
  test("On an unbound sim ctx, `service({ contract: b })` of module `b` sends its request to `http://b.keel.invalid` plus the entry's path.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,8}$/), async (id) => {
        const api = service({ contract: b });
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const urls: string[] = [];
        ctx.net.route("*", (req) => {
          urls.push(req.url);
          return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
        });
        await api.get({ params: { id } }, ctx);
        expect(urls).toEqual([`http://b.keel.invalid/b/${id}`]);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
