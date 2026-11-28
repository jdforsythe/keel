// The Tauri crate name of an app (std.tauri Files): from its package name, never empty. Seed 1337.
import fc from "fast-check";
import { expect, test } from "vitest";
import { crateName } from "../src/tools/crateName.ts";

test("the scope goes, the name is lower-cased, other characters become -, and it starts at its first letter", () => {
  expect(crateName("@acme/My_App")).toBe("my_app");
  expect(crateName("golden-1")).toBe("golden-1");
  expect(crateName("My App.x")).toBe("my-app-x");
  expect(crateName("9lives")).toBe("lives");
  expect(crateName("")).toBe("app");
  expect(crateName("@acme/123")).toBe("app");
});

test("property: a crate name is a non-empty Cargo-safe name starting with a letter", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 20 }), (name) => {
      expect(crateName(name)).toMatch(/^[a-z][a-z0-9_-]*$/);
    }),
    { seed: 1337, numRuns: 200 },
  );
});
