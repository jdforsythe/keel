// Property: the `keel_storage` payloads of any sorted key list are JSON `{"o","k"}`, each at most 7,900 bytes, and together hold the keys once, in order (std.db).
import fc from "fast-check";
import { expect, test } from "vitest";
import { notifyPayloads } from "../src/postgres/notifyPayloads.server.ts";

test("payloads split any key list under 7,900 bytes and lose or repeat no key", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(fc.string({ minLength: 1, maxLength: 300 }), { maxLength: 120 }),
      fc.nat({ max: 10 ** 9 }),
      (names, o) => {
        const keys = names.map((n) => `keel.store.${n}`).sort();
        const payloads = notifyPayloads(String(o), keys);
        const back: string[] = [];
        for (const p of payloads) {
          expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(7900);
          const parsed: unknown = JSON.parse(p);
          expect(Object.keys(Object(parsed))).toEqual(["o", "k"]);
          expect(Reflect.get(Object(parsed), "o")).toBe(o);
          const k: unknown = Reflect.get(Object(parsed), "k");
          if (Array.isArray(k)) back.push(...k.map(String));
        }
        expect(back).toEqual(keys);
        expect(payloads.length === 0).toBe(keys.length === 0);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});

test("a key whose own entry cannot fit one payload is announced in none, and its neighbours still are", () => {
  const small = "keel.store.a";
  const huge = `keel.store.${"x".repeat(8000)}`;
  const payloads = notifyPayloads("5", [small, huge, "keel.store.z"]);
  for (const p of payloads) expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(7900);
  const announced = payloads.flatMap((p) => {
    const k: unknown = Reflect.get(Object(JSON.parse(p)), "k");
    return Array.isArray(k) ? k.map(String) : [];
  });
  expect(announced).toEqual([small, "keel.store.z"]);
  expect(notifyPayloads("5", [huge])).toEqual([]);
});
