// The build's `capacitor.config.json` (std.capacitor Build): the generated keys kept, `plugins.KeelHttp.allow` set. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { allowConfig } from "../src/tools/allowConfig.ts";
import { capacitorConfig } from "../src/tools/capacitorConfig.ts";

const run = { seed: 1337, numRuns: 100 };
const origin = fc.stringMatching(/^[a-z]{1,6}$/).map((h) => `https://${h}.example`);

describe("allowConfig", () => {
  test("allow is the origin then connect, each once, beside the generated keys", () => {
    fc.assert(
      fc.property(origin, fc.uniqueArray(origin, { maxLength: 4 }), (o, connect) => {
        const out: unknown = JSON.parse(allowConfig(capacitorConfig({ id: "dev.keel.a", name: "A" }), o, connect));
        expect(out).toEqual({
          appId: "dev.keel.a",
          appName: "A",
          webDir: "www",
          plugins: { KeelHttp: { allow: [o, ...connect.filter((c) => c !== o)] } },
        });
      }),
      run,
    );
  });

  test("a second pass replaces the list and keeps another plugin's configuration", () => {
    const first = allowConfig('{ "plugins": { "Other": { "a": 1 } } }', "https://a.example", ["https://b.example"]);
    expect(JSON.parse(allowConfig(first, "https://c.example", []))).toEqual({
      plugins: { Other: { a: 1 }, KeelHttp: { allow: ["https://c.example"] } },
    });
  });

  test("text that is no JSON object yields the list alone, ending in a newline", () => {
    for (const bad of ["", "nope", "[]", "null", "3"]) {
      const out = allowConfig(bad, "https://a.example", []);
      expect(out.endsWith("}\n")).toBe(true);
      expect(JSON.parse(out)).toEqual({ plugins: { KeelHttp: { allow: ["https://a.example"] } } });
    }
  });

  test("with no origin the list is `connect` alone, and empty when it is", () => {
    expect(JSON.parse(allowConfig("{}", undefined, ["https://b.example"]))).toEqual({
      plugins: { KeelHttp: { allow: ["https://b.example"] } },
    });
    expect(JSON.parse(allowConfig("{}", undefined, []))).toEqual({ plugins: { KeelHttp: { allow: [] } } });
  });
});
