// @vitest-environment node
// Spec: k.contract, clause "`.keel/routes.json` of a contract with a `local: true` API entry marks that entry `local: true`; `local: false` on an entry is E1510."
// k.contract Local routes: "`.keel/routes.json` marks the entry `local: true`, so the surface shows it."
// Seed: n/a (one fixture). Method: local-routes-support.ts: the real `keel build` of the fixture, whose `app.panel` (page), `app.probe` (API GET) and `app.mutate` (API POST) are `local: true` and `app.open` and `app.counts` are not; `.keel/routes.json` is read back.
// ASSUMED: `.keel/routes.json` is `{ data, hash }` with `data` keyed by route id, as `routesArtifact` returns it; a route that is not local carries no `local: true`. The router half (`local: false` is E1510, `routesArtifact`) is packages/router/conformance/contract-local-member.test.ts.
import fs from "node:fs";
import path from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REMOVE, buildFixture } from "./local-routes-support.ts";

let root = "";
beforeAll(() => {
  const b = buildFixture();
  root = b.root;
  expect(b.status, b.out).toBe(0);
}, fixedTime(600_000));
afterAll(() => REMOVE(root));

const dataOf = (): Record<string, unknown> => {
  const doc: unknown = JSON.parse(fs.readFileSync(path.join(root, ".keel", "routes.json"), "utf8"));
  const data = typeof doc === "object" && doc !== null ? Reflect.get(doc, "data") : undefined;
  if (typeof data !== "object" || data === null) throw new Error("routes.json has no data");
  return Object.fromEntries(Object.entries(data));
};

describe("k.contract local routes in routes.json", () => {
  it("`.keel/routes.json` of a contract with a `local: true` API entry marks that entry `local: true`; `local: false` on an entry is E1510", () => {
    const data = dataOf();
    for (const id of ["app.panel", "app.probe", "app.mutate"])
      expect(Reflect.get(data[id] ?? {}, "local"), id).toBe(true);
    for (const id of ["app.open", "app.counts"]) expect(Reflect.get(data[id] ?? {}, "local"), id).not.toBe(true);
  });
});
