// `SessionsConfig` is registered under `@keel/std-sessions`, so a misshapen `std` entry is
// E1158; `redact`, `expose` and `readers` are optional string arrays, and only `redact` reaches browsers (D2).
// Seed 1337 (no random inputs)
import { stdArtifact } from "@keel/compiler";
import { clientStdData } from "@keel/compiler/std/clientStdData";
import "@keel/std-sessions";
import { expect, test } from "vitest";

const manifest = (config: string) => ({
  path: "modules/app/module.ts",
  source: `import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: ["@keel/std-sessions"], std: { "@keel/std-sessions": ${config} } });\n`,
});

test('std config `redact: 5` is E1158 and `redact: ["password"]` is accepted', () => {
  const bad = stdArtifact([manifest("{ redact: 5 }")]);
  expect(bad.diagnostics.map((d) => d.code)).toEqual(["E1158"]);
  expect(bad.data["@keel/std-sessions"]).toBeUndefined();
  const good = stdArtifact([manifest('{ redact: ["password"] }')]);
  expect(good.diagnostics).toEqual([]);
  expect(good.data["@keel/std-sessions"]).toEqual({ app: { redact: ["password"] } });
});

test("`expose` and `readers` are accepted; a bad reader or an unknown key is E1158", () => {
  expect(stdArtifact([manifest('{ redact: [], expose: ["store:app.x#name"], readers: ["h1"] }')]).diagnostics).toEqual(
    [],
  );
  expect(stdArtifact([manifest("{ readers: [1] }")]).diagnostics.map((d) => d.code)).toEqual(["E1158"]);
  expect(stdArtifact([manifest("{ other: [] }")]).diagnostics.map((d) => d.code)).toEqual(["E1158"]);
});

test("browsers get only `redact`: `readers` and `expose` stay on the server", () => {
  const { data } = stdArtifact([
    manifest('{ redact: ["el:app.x#value"], expose: ["store:app.x#n"], readers: ["h1"] }'),
  ]);
  expect(clientStdData(data, new Set(["app"]))).toEqual({
    "@keel/std-sessions": { app: { redact: ["el:app.x#value"] } },
  });
});
