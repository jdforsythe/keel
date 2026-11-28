// `pageOf` reads a page entry from a route table's public contracts: a page of any module, never an API entry or a
// layout. Seed 1337 (fixed fixtures).
import { manifest, routeTable } from "@keel/router";
import { action } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { expect, test } from "vitest";
import { pageOf } from "../src/internal/pageOf.ts";

const Id = s.object({ id: s.string() });
const page = (): Node => document.createElement("main");

test("a page of either module is found with its path and schemas; an API entry, a layout or an unknown id is not", () => {
  const a = contract("a", { "a.show": { path: "/a/:id", params: Id }, "a.shell": { layout: true } });
  const b = contract("b", {
    "b.save": { method: "POST", path: "/api/b", output: s.object({}) },
    "b.home": { path: "/b" },
  });
  const save = action(b, "b.save", {}, () => ok({}));
  const table = routeTable(
    manifest(a, { "a.show": { component: page, layout: "a.shell" }, "a.shell": { component: page } }),
    manifest(b, { "b.save": { action: save }, "b.home": { component: page } }),
  );
  expect(pageOf(table, "a.show")).toMatchObject({ path: "/a/:id", params: Id });
  expect(pageOf(table, "b.home")).toEqual({ path: "/b" });
  expect(pageOf(table, "b.save")).toBeUndefined();
  expect(pageOf(table, "a.shell")).toBeUndefined();
  expect(pageOf(table, "c.none")).toBeUndefined();
});
