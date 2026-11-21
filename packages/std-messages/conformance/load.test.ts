// Spec: std.messages, clause "`Set.load('de-DE')` resolves to the fixture's `de-DE` entry; for a locale file failing the set it rejects."
// Seed 1337 (no random inputs)
import { expect, test } from "vitest";

test("`Set.load('de-DE')` resolves to the fixture's `de-DE` entry; for a locale file failing the set it rejects.", async () => {
  const { Broken } = await import("./fixtures/Broken.schema.ts");
  const { Demo } = await import("./fixtures/Demo.schema.ts");
  const { default: deDE } = await import("./fixtures/Demo/de-DE.ts");
  await expect(Demo.load("de-DE")).resolves.toEqual(deDE);
  await expect(Broken.load("en-US")).resolves.toEqual({ title: "Fine" });
  await expect(Broken.load("de-DE")).rejects.toThrow();
});
