// Spec: k.inspect, clause "The served `graph` equals `inspect()` taken outside the request."
// @vitest-environment happy-dom
// No generated inputs; the per-request server scope must not appear in the served graph.
import { inspect } from "@keel/reactive";
import { expect, test } from "vitest";
import { BASE, build } from "./fixtures.ts";

test("The served `graph` equals `inspect()` taken outside the request", async () => {
  const { app } = await build({}, "dev");
  const outside = JSON.parse(JSON.stringify(inspect()));
  const res = await app.fetch(new Request(`${BASE}/__keel/inspect`));
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  expect(Reflect.get(Object(body), "graph")).toEqual(outside);
});
