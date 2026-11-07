// Backlog 0203: `SessionsConfig` is registered under `@keel/std-sessions`, so a misshapen `std` entry is E1158.
// Seed 1337 (no random inputs)
import { stdArtifact } from "@keel/compiler";
import "@keel/std-sessions";
import { expect, test } from "vitest";

const manifest = (redact: string) => ({
  path: "modules/app/module.ts",
  source: `import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: ["@keel/std-sessions"], std: { "@keel/std-sessions": { redact: ${redact} } } });\n`,
});

test('std config `redact: 5` is E1158 and `redact: ["password"]` is accepted', () => {
  const bad = stdArtifact([manifest("5")]);
  expect(bad.diagnostics.map((d) => d.code)).toEqual(["E1158"]);
  expect(bad.data["@keel/std-sessions"]).toBeUndefined();
  const good = stdArtifact([manifest('["password"]')]);
  expect(good.diagnostics).toEqual([]);
  expect(good.data["@keel/std-sessions"]).toEqual({ app: { redact: ["password"] } });
});
