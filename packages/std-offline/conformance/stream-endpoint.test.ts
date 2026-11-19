// Spec: std.outbox, clause "`outbox` throws E2652 (an Error with `code`) for an api with an `events: true` endpoint."
// Seed 1337
// Assumption: `events` is not in the typed `Endpoint` yet, so the api is built from a plain object through `Reflect.apply`
// (as k.services' events-endpoint conformance does); `outbox` is called inside a scope, as a store needs an owner.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import { outbox } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Api, MODULE } from "./fixtures.ts";

const names = fc.constantFrom("watch", "feed", "tail");

test("`outbox` throws E2652 (an Error with `code`) for an api with an `events: true` endpoint.", () => {
  fc.assert(
    fc.property(names, fc.boolean(), (name, withOrdinary) => {
      const def = {
        ...(withOrdinary ? { plain: { method: "GET", path: "/plain", output: s.int() } } : {}),
        [name]: { method: "GET", path: `/${name}`, output: s.int(), events: true },
      };
      const api: unknown = Reflect.apply(endpoints, undefined, [def]);
      let thrown: unknown;
      const sc = scope(() => {
        try {
          Reflect.apply(outbox, undefined, [`stream.${name}.outbox`, api, { module: MODULE }]);
        } catch (e) {
          thrown = e;
        }
      });
      sc.dispose();
      expect(thrown).toBeInstanceOf(Error);
      expect(thrown instanceof Error ? Reflect.get(thrown, "code") : undefined).toBe("E2652");
    }),
    { seed: 1337, numRuns: 10 },
  );
  // control: an api without a stream endpoint still declares
  const sc = scope(() => {
    expect(() => outbox("stream.control.outbox", Api, { module: MODULE })).not.toThrow();
  });
  sc.dispose();
});
