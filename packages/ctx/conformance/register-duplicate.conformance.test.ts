// k.ctx registry: registering a name twice is E1602
import { expect, test } from "vitest";
import { register } from "@keel/ctx";

const impls = {
  real: () => ({}),
  shell: () => ({}),
  sim: () => ({}),
};

test("registering the same name twice throws Error with code E1602", () => {
  register("dupcap", impls);
  let caught: unknown;
  try {
    register("dupcap", impls);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(Reflect.get(Object(caught), "code")).toBe("E1602");
});

test("registering a kernel name again throws E1602", () => {
  let caught: unknown;
  try {
    register("clock", impls);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(Reflect.get(Object(caught), "code")).toBe("E1602");
});
