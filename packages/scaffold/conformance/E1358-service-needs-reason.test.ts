// Spec: k.scaffold-service, Conformance "In the default project, with no `reason`, that input and the `{ id, schema, service }` form are each E1358 naming `web` and `https://api.example.com`, nothing written; with `connect` already declaring that origin, each applies without a `reason` and leaves `topology.ts` byte-identical, and with one is E1052."
// Spec: k.scaffold-service, Rules "E1358 `service` in a module of a `client` deployable whose origin that deployable does not declare under `connect`, with no `reason`; names the deployable and the origin"
// seed 1337 (property over hosts and module ids).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  RUNS,
  SEED,
  SERVICE_INPUT,
  apply,
  errText,
  fresh,
  lowerName,
  read,
  scaffoldRaw,
  serviceInput,
  snap,
} from "./fixtures.ts";
import { ORIGIN, REASON, withConnect, withModuleClient } from "./service-base-support.ts";

const forms: [string, Record<string, unknown>][] = [
  ["base", { id: "orders", base: ORIGIN }],
  ["schema and service", SERVICE_INPUT],
];

describe("E1358: service in a client module with an undeclared origin and no reason", () => {
  for (const [form, input] of forms) {
    it(`the ${form} form is E1358 naming web and ${ORIGIN}, and writes nothing`, () => {
      const f = fresh();
      const before = snap(f);
      const r = scaffoldRaw("service", input, f);
      expect(r.ok).toBe(false);
      const t = errText(r);
      expect(t).toContain("E1358");
      expect(t).toContain("web");
      expect(t).toContain(ORIGIN);
      expect(snap(f)).toBe(before);
    });
    it(`the ${form} form applies without a reason when connect already declares the origin, leaving topology.ts byte-identical`, () => {
      const f = withConnect(fresh(), { [ORIGIN]: "declared earlier" });
      const out = apply("service", input, f);
      expect(read(out.files, "topology.ts")).toBe(read(f, "topology.ts"));
      expect(out.changed).not.toContain("topology.ts");
      expect(out.created).toContain("modules/orders/api.server.ts");
    });
    it(`the ${form} form with a reason is E1052 when connect already declares the origin, and writes nothing`, () => {
      const f = withConnect(fresh(), { [ORIGIN]: "declared earlier" });
      const before = snap(f);
      const r = scaffoldRaw("service", { ...input, reason: REASON }, f);
      expect(r.ok).toBe(false);
      expect(errText(r)).toContain("E1052");
      expect(snap(f)).toBe(before);
    });
  }
  it("for any module and host, an undeclared origin with no reason is E1358 naming web and that origin, and writes nothing", () => {
    fc.assert(
      fc.property(lowerName, lowerName, fc.boolean(), (id, host, viaBase) => {
        const origin = `https://${host}.example.com`;
        const f = withModuleClient(id);
        const before = snap(f);
        const input = viaBase
          ? { id, base: origin }
          : { ...serviceInput(id), service: serviceInput(id).service.replaceAll(ORIGIN, origin) };
        const r = scaffoldRaw("service", input, f);
        expect(r.ok).toBe(false);
        const t = errText(r);
        expect(t).toContain("E1358");
        expect(t).toContain("web");
        expect(t).toContain(origin);
        expect(snap(f)).toBe(before);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("a declared origin elsewhere in connect does not stand for this one: E1358 still", () => {
    const f = withConnect(fresh(), { "https://other.example.com": "declared earlier" });
    const r = scaffoldRaw("service", { id: "orders", base: ORIGIN }, f);
    expect(r.ok).toBe(false);
    expect(errText(r)).toContain("E1358");
  });
});
