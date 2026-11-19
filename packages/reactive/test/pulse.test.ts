// Seed 1337. `@keel/reactive/internal` pulse and resource ids (rfc:0070).
import fc from "fast-check";
import { expect, test } from "vitest";
import { computed } from "../src/computed.ts";
import { effect } from "../src/effect.ts";
import { inspect } from "../src/inspect.ts";
import { lastResource } from "../src/internal/lastResource.ts";
import { pulse } from "../src/internal/pulse.ts";
import { resource } from "../src/resource.ts";
import { scope } from "../src/scope.ts";

test("fire reruns each effect that read the pulse once per fire, until it is disposed", () => {
  fc.assert(
    fc.property(fc.nat(10), fc.nat(10), (before, after) => {
      const p = pulse();
      let runs = 0;
      const sc = scope(() =>
        effect(() => {
          p.read();
          runs++;
        }),
      );
      for (let i = 0; i < before; i++) p.fire();
      expect(runs).toBe(1 + before);
      sc.dispose();
      for (let i = 0; i < after; i++) p.fire();
      expect(runs).toBe(1 + before);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("fire inside an effect that declared no writes is allowed and reruns readers after it", () => {
  const p = pulse();
  const seen: number[] = [];
  let n = 0;
  scope(() => {
    effect(() => {
      p.read();
      seen.push(++n);
    });
    effect(() => p.fire(), { writes: [] });
  }).dispose();
  expect(seen).toEqual([1, 2]);
});

test("computeds reading a pulse recompute on fire; a pulse is not an inspect node", () => {
  const p = pulse();
  let k = 0;
  const seen: number[] = [];
  const sc = scope(() => {
    const c = computed(() => {
      p.read();
      return ++k;
    });
    effect(() => void seen.push(c.get()));
  });
  p.fire();
  expect(seen).toEqual([1, 2]);
  expect(inspect().nodes.some((n) => n.id === 0)).toBe(false);
  sc.dispose();
});

test("lastResource holds the inspect() node id of the resource read last", () => {
  const sc = scope(() => {
    const r = resource(() => Promise.resolve(1));
    lastResource.id = 0;
    r.get();
    const id = lastResource.id;
    expect(inspect().nodes.find((n) => n.id === id)?.kind).toBe("resource");
  });
  sc.dispose();
});
