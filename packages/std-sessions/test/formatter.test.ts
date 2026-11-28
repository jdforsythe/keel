// The `session` record kind (std.sessions; docs/OUTPUT.md) rendered through `respond` (@keel/cli/testing). Seed 1337 (no random inputs)
import { respond } from "@keel/cli/testing";
import { expect, test } from "vitest";
import "../src/tools.ts";

const rec = {
  kind: "session",
  id: "de36c499-eccd-4673-b35d-ceb5c9d615ab",
  fingerprint: "7f3a9c01d2e4",
  route: "orders.show",
  events: 42,
  inputs: 9,
  error: "orders.locked",
  file: null,
};

test("compact is `<fingerprint> <route> <n> events <code|ok>` plus ` -> <file>` when one was written", () => {
  expect(respond([rec]).stdout).toContain("7f3a9c01d2e4 orders.show 42 events orders.locked");
  const wrote = respond([{ ...rec, error: null, file: "sessions/failing.json" }]).stdout;
  expect(wrote).toContain("7f3a9c01d2e4 orders.show 42 events ok -> sessions/failing.json");
});

test("pretty adds the inputs count and the file on a second line; json is the record", () => {
  const pretty = respond([{ ...rec, file: "a.json" }], { format: "pretty" }).stdout;
  expect(pretty).toContain("9 inputs");
  expect(pretty).toContain("\n  file: a.json");
  expect(JSON.parse(respond([rec], { format: "json" }).stdout.split("\n")[0] ?? "")).toEqual(rec);
});

test("a record that does not fit the schema is E1054", () => {
  expect(respond([{ ...rec, events: "many" }]).stdout).toContain("E1054");
});
