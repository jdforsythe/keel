import { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { expect, test } from "vitest";

const AppLocale = s.enum(["en-US", "de-DE"]);
const load = (locale: string) => import(`./fixtures/${locale}.ts`);
const issues = (set: { parse(x: unknown): { ok: boolean } }, x: unknown) => set.parse(x).ok;

test("messages throws for keys or params that are not identifiers, wrapped params and non-enum locales", () => {
  expect(() => messages(AppLocale, { "a-b": {} }, load)).toThrow();
  expect(() => messages(AppLocale, { a: { "x-y": s.int() } }, load)).toThrow();
  expect(() => messages(AppLocale, { a: { n: s.int().optional() } }, load)).toThrow();
  expect(() => messages(AppLocale, { a: { j: s.json() } }, load)).toThrow();
  expect(() => messages(s.literal("en-US"), { a: {} }, load)).toThrow();
});

test("templates: 1 to 2,000 characters, no literal braces, placeholders name declared params", () => {
  const Demo = messages(AppLocale, { t: {}, p: { n: s.int(), k: s.enum(["a", "b"]) } }, load);
  const ok = (t: unknown, p: unknown) => issues(Demo, { t, p });
  expect(ok("x".repeat(2000), { text: "{n}" })).toBe(true);
  expect(ok("x".repeat(2001), { text: "{n}" })).toBe(false);
  expect(ok("", { text: "{n}" })).toBe(false);
  expect(ok("a}b", { text: "{n}" })).toBe(false);
  expect(ok("Hi", { text: "{ n }" })).toBe(false);
  expect(ok("Hi", { text: "{n} {k}", other: "x" })).toBe(false);
  expect(ok("Hi", { plural: "n", one: "# x" })).toBe(false);
  expect(ok("Hi", { plural: "n", other: "# x", some: "y" })).toBe(false);
  expect(ok("Hi", { plural: "n", other: "# {k}", few: "{n}" })).toBe(true);
  expect(ok("Hi", { select: "k", cases: { a: "A", b: "B", c: "C" } })).toBe(false);
  expect(ok("Hi", { select: "k", cases: { a: "A", b: "B" }, extra: 1 })).toBe(false);
  expect(ok("Hi", { select: "k", cases: { a: "A {n}", b: "B" } })).toBe(true);
  expect(ok("Hi", "text")).toBe(false);
});

test("load rejects a locale file without a default export", async () => {
  const Demo = messages(AppLocale, { title: {} }, async () => ({}));
  await expect(Demo.load("en-US")).rejects.toThrow(/"rule":"type"/);
});

test("load parses the locale first: a tag outside the enum rejects with rule enum, imports nothing and shows no path", async () => {
  let calls = 0;
  const counted = async (locale: string) => {
    calls++;
    return import(`./fixtures/${locale}.ts`);
  };
  const Demo = messages(AppLocale, { a: {} }, counted);
  // The set's type admits only AppLocale tags; an unparsed value (a layout's params) reaches load at run time.
  // `load` is declared with method syntax, so its parameter is bivariant and this widening needs no cast.
  const wide: { load(locale: string): Promise<unknown> } = Demo;
  for (const bad of ["../evil", "fr-FR", "en-us", ""]) {
    const e = await wide.load(bad).then(
      () => undefined,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(Error);
    const message = e instanceof Error ? e.message : "";
    expect(message).toContain('"rule":"enum"');
    expect(message).not.toMatch(/[\\/]|fixtures|\.ts/);
    if (bad !== "") expect(message).not.toContain(bad);
  }
  expect(calls).toBe(0);
  await expect(Demo.load("de-DE")).resolves.toEqual({ a: "A" });
  expect(calls).toBe(1);
});
