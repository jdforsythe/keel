// failedDist (k.api Rules): the dist/<name> folders a build failing with E1510 or E1511 leaves none of. Seed 1337.
import type { Topology } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { failedDist } from "../src/internal/failedDist.ts";

const SEED = 1337;
const TOPOLOGY: Topology = {
  api: { modules: ["a", "b"], adapter: "node" },
  web: { modules: ["c"], adapter: "client" },
};
const diag = (code: string, message: string, path = "topology.ts") => ({ kind: "diag", code, message, path });

describe("failedDist", () => {
  it("names the deployable serving an E1510 entry's module, from its id or its path", () => {
    fc.assert(
      fc.property(fc.constantFrom("a", "b", "c"), fc.stringMatching(/^[a-z]{1,8}$/), (m, key) => {
        const want = [m === "c" ? "dist/web" : "dist/api"];
        expect(failedDist([diag("E1510", `${m}.${key}: local takes the literal true`)], TOPOLOGY)).toEqual(want);
        expect(
          failedDist([diag("E1510", "a contract entry is of no kind", `modules/${m}/${m}.contract.ts`)], TOPOLOGY),
        ).toEqual(want);
      }),
      { seed: SEED },
    );
  });

  it("names the deployable an E1511 message names", () => {
    const r = diag("E1511", "c.tools: local route in client deployable web, which has no server");
    expect(failedDist([r], TOPOLOGY)).toEqual(["dist/web"]);
  });

  it("names every deployable when no module is found, and none for other codes or records", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(failedDist([diag("E1510", ` ${message}`, "elsewhere.ts")], TOPOLOGY)).toEqual(["dist/api", "dist/web"]);
        expect(failedDist([diag("E1502", message), { kind: "summary", code: "E1510", message }], TOPOLOGY)).toEqual([]);
      }),
      { seed: SEED },
    );
  });
});
