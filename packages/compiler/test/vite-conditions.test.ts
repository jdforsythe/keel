// k.library In an app: every Vite environment resolves with the `keel` condition beside its own conditions.
import { expect, it } from "vitest";
import keel from "../src/vite.ts";

it("an environment with no conditions gets Vite's defaults and `keel`; one with its own keeps them and gains `keel`", () => {
  const p = keel();
  expect(p.configEnvironment("client", {})).toEqual({
    resolve: { conditions: ["keel", "module", "browser", "development|production"] },
  });
  expect(p.configEnvironment("ssr", {})).toEqual({
    resolve: { conditions: ["keel", "module", "node", "development|production"] },
  });
  expect(p.configEnvironment("web", { consumer: "client" })).toEqual({
    resolve: { conditions: ["keel", "module", "browser", "development|production"] },
  });
  // Vite merges the returned list after the environment's own (an `exports` map's key order decides, not this list's).
  expect(p.configEnvironment("client", { resolve: { conditions: ["node"] } })).toEqual({
    resolve: { conditions: ["keel"] },
  });
  expect(p.configEnvironment("ssr", { resolve: { conditions: ["keel", "node"] } })).toBeNull();
});
