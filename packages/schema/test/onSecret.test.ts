// Seed 1337. The internal listener slot @keel/server reads: `Secret.of` calls the one listener `onSecret` holds with
// each new `Secret` that `parse`, `decodeStrings` and `gen` make, and calls nothing when no listener is held.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { Secret } from "../src/Secret.ts";
import { gen } from "../src/gen.ts";
import { reveal, s } from "../src/index.ts";
import { onSecret } from "../src/internal/index.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const heard: Secret<unknown>[] = [];
const clears: (() => void)[] = [];
const listen = (into: Secret<unknown>[]): void => {
  clears.push(onSecret((made) => into.push(made)));
};
afterEach(() => {
  for (const clear of clears.splice(0)) clear();
  heard.length = 0;
});

/** What `x` holds, read without calling the listener (`reveal` calls it). */
const shown = (x: Secret<unknown>): unknown => {
  const v = Secret.open(x);
  return typeof v === "object" && v !== null ? "object" : v;
};

describe("onSecret", () => {
  it("hears each secret parse makes, a nested secret before its parent", () => {
    listen(heard);
    const schema = s.object({ a: s.secret(s.string()), b: s.secret(s.object({ c: s.secret(s.int()) })) });
    const r = schema.parse({ a: "k1", b: { c: 7 }, d: "plain" });
    expect(r.ok).toBe(true);
    expect(heard.map(shown)).toEqual(["k1", 7, "object"]);
    if (!r.ok) return;
    expect(heard[0]).toBe(r.value.a);
    expect(heard[2]).toBe(r.value.b);
    expect(heard[1]).toBe(Secret.open(r.value.b).c);
  });

  it("hears each secret decodeStrings makes", () => {
    listen(heard);
    const schema = s.object({ token: s.secret(s.string()), n: s.secret(s.number()), plain: s.string() });
    const r = schema.decodeStrings({ token: "tok-9", n: "12", plain: "x" });
    expect(r.ok).toBe(true);
    expect(heard.map(shown)).toEqual(["tok-9", 12]);
  });

  it("hears each secret gen makes", () => {
    listen(heard);
    const schema = s.secret(s.string());
    fc.assert(
      fc.property(gen(schema), (v) => {
        expect(heard).toContain(v);
      }),
    );
    expect(heard.length).toBeGreaterThan(0);
  });

  it("hears nothing when parse is given an existing Secret", () => {
    const schema = s.secret(s.string());
    const first = schema.parse("k");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    listen(heard);
    const again = schema.parse(first.value);
    expect(again.ok && again.value).toBe(first.value);
    expect(heard).toEqual([]);
  });

  it("a second onSecret replaces the first", () => {
    const one: Secret<unknown>[] = [];
    listen(one);
    listen(heard);
    s.secret(s.string()).parse("k");
    expect(one).toEqual([]);
    expect(heard.map(shown)).toEqual(["k"]);
  });

  it("the returned function clears only its own listener", () => {
    const one: Secret<unknown>[] = [];
    const clearOne = onSecret((made) => one.push(made));
    listen(heard);
    clearOne();
    s.secret(s.string()).parse("still");
    expect(heard.map(shown)).toEqual(["still"]);
    expect(one).toEqual([]);
    for (const clear of clears.splice(0)) clear();
    s.secret(s.string()).parse("gone");
    expect(heard.map(shown)).toEqual(["still"]);
  });

  it("with no listener parse behaves as before", () => {
    const schema = s.object({ a: s.secret(s.string()), b: s.int() });
    fc.assert(
      fc.property(fc.string(), fc.integer(), (a, b) => {
        const r = schema.parse({ a, b });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(reveal(r.value.a)).toBe(a);
        expect(r.value.b).toBe(b);
        expect(JSON.stringify(r.value)).toBe(JSON.stringify({ a: "[secret]", b }));
      }),
    );
    expect(heard).toEqual([]);
  });
});

describe("@keel/schema source", () => {
  it("imports no node: module", () => {
    const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    const importing = files.filter((f) =>
      /from\s+["']node:|import\(\s*["']node:/.test(readFileSync(path.join(src, f), "utf8")),
    );
    expect(importing).toEqual([]);
  });
});
