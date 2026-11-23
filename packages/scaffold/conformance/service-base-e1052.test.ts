// Spec: k.scaffold, Conformance "E1052, nothing written: a `reason` in the `node` project; `base` with `schema` and `service`; none of the three; a `base` of `ftp://a.example`, `/v1`, `https://a.example/?q=1` or `https://u:p@a.example`."
// Spec: k.scaffold, Service "`base` alone, or `schema` and `service` together; anything else is E1052." and "an absolute `http` or `https` URL with no query, fragment or credentials (else E1052)".
// seed 1337 (property over malformed base values).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, SERVICE_INPUT, errText, fresh, lowerName, scaffoldRaw, snap } from "./fixtures.ts";
import { ORIGIN, REASON, freshNode } from "./service-base-support.ts";

function refused(files: ReturnType<typeof fresh>, input: Record<string, unknown>): void {
  const before = snap(files);
  const r = scaffoldRaw("service", input, files);
  expect(r.ok, JSON.stringify(input)).toBe(false);
  expect(errText(r), JSON.stringify(input)).toContain("E1052");
  expect(snap(files)).toBe(before);
}

describe("service E1052, nothing written", () => {
  it("a reason in the node project", () => {
    refused(freshNode(), { id: "orders", base: ORIGIN, reason: REASON });
    refused(freshNode(), { ...SERVICE_INPUT, reason: REASON });
  });
  it("base with schema and service", () => {
    refused(freshNode(), { ...SERVICE_INPUT, base: ORIGIN });
    refused(fresh(), { ...SERVICE_INPUT, base: ORIGIN, reason: REASON });
  });
  it("none of the three: no base, no schema, no service", () => {
    refused(freshNode(), { id: "orders" });
    refused(fresh(), { id: "orders" });
  });
  it("schema without service, or service without schema", () => {
    refused(freshNode(), { id: "orders", schema: SERVICE_INPUT.schema });
    refused(freshNode(), { id: "orders", service: SERVICE_INPUT.service });
  });
  for (const base of ["ftp://a.example", "/v1", "https://a.example/?q=1", "https://u:p@a.example"]) {
    it(`a base of ${base}, in the node project and in the default project with a reason`, () => {
      refused(freshNode(), { id: "orders", base });
      refused(fresh(), { id: "orders", base, reason: REASON });
    });
  }
  it("any base that is not absolute http or https, or has a query, fragment or credentials", () => {
    const bad = fc.oneof(
      lowerName.map((w) => `https://${w}.example/?${w}=1`),
      lowerName.map((w) => `https://${w}.example#${w}`),
      lowerName.map((w) => `https://${w}:${w}@${w}.example`),
      lowerName.map((w) => `http://${w}@${w}.example`),
      fc.constantFrom("ftp", "ws", "wss", "file", "ssh").chain((s) => lowerName.map((w) => `${s}://${w}.example`)),
      lowerName.map((w) => `/${w}`),
      lowerName.map((w) => `${w}.example`),
    );
    fc.assert(
      fc.property(bad, (base) => {
        refused(freshNode(), { id: "orders", base });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
