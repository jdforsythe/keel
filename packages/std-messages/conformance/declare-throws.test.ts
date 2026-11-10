// Spec: std.messages, clause "`messages` throws for a param schema `s.object({})`."
// Seed 1337 (no random inputs)
import { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { expect, test } from "vitest";
import { AppLocale } from "./fixtures/AppLocale.schema.ts";

test.skip("`messages` throws for a param schema `s.object({})`.", () => {
  const load = (locale: string) => import(`./fixtures/Demo/${locale}.ts`);
  expect(() => messages(AppLocale, { bad: { o: s.object({}) } }, load)).toThrow();
  // Allowed param schemas do not throw.
  expect(() =>
    messages(AppLocale, { ok: { a: s.string(), b: s.int(), c: s.number(), d: s.enum(["x"]) } }, load),
  ).not.toThrow();
});
