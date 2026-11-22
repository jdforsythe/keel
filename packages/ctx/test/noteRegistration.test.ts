// k.data Dev: under `keel dev` (a map at `Symbol.for("keel.dev.registrations")`) `register` records the stack it ran
// on, by capability name, so the dev server finds the files that registered it; with no map it records nothing.
import { afterEach, expect, test } from "vitest";
import { register } from "../src/register.ts";

const KEY = Symbol.for("keel.dev.registrations");
const impls = { real: () => ({}), shell: () => ({}), sim: () => ({}) };

afterEach(() => {
  Reflect.deleteProperty(globalThis, KEY);
});

test("register records its stack under a dev server's map, and nothing without one", () => {
  register("t.noted.none", impls);
  const heard = new Map<string, string>();
  Reflect.set(globalThis, KEY, heard);
  register("t.noted", impls);
  expect([...heard.keys()]).toEqual(["t.noted"]);
  expect(heard.get("t.noted")).toContain("noteRegistration.test.ts");
});
