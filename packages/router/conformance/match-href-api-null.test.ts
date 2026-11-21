// @vitest-environment happy-dom
// Spec: k.api, clause "`matchHref` of an API entry's path is `null`."
// Seed 1337
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { matchHref } from "@keel/router/match";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./contract-support.ts";

const Id = s.object({ id: s.string() });
const Out = s.object({ n: s.int() });
const c = contract("a", {
  "a.home": { path: "/" },
  "a.list": { method: "GET", path: "/api/items", output: Out },
  "a.item": { method: "GET", path: "/api/items/:id", params: Id, output: Out },
});
const routes = manifest(c, {
  "a.home": { component: () => document.createElement("div") },
  "a.list": { loader: loader(c, "a.list", {}, async () => ok({ n: 1 })) },
  "a.item": { loader: loader(c, "a.item", {}, async () => ok({ n: 1 })) },
});

describe("k.api matchHref", () => {
  it("`matchHref` of an API entry's path is `null`.", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9]{1,8}$/), (id) => {
        expect(matchHref(routes, "/api/items")).toBeNull();
        expect(matchHref(routes, `/api/items/${id}`)).toBeNull();
        // a page of the same table still matches
        expect(matchHref(routes, c.href("a.home"))).toEqual({ id: "a.home", params: {}, search: {} });
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
