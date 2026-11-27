// k.library In an app: every Vite environment resolves with the `keel` condition beside its own conditions.
// k.gamut CSS: a browser environment minifies CSS with esbuild's minifier, which keeps each color as compiled.
import { expect, it } from "vitest";
import keel from "../src/vite.ts";

const CSS = { build: { cssMinify: "esbuild" } };

it("an environment with no conditions gets Vite's defaults and `keel`; one with its own keeps them and gains `keel`", () => {
  const p = keel();
  expect(p.configEnvironment("client", {})).toEqual({
    resolve: { conditions: ["keel", "module", "browser", "development|production"] },
    ...CSS,
  });
  expect(p.configEnvironment("ssr", {})).toEqual({
    resolve: { conditions: ["keel", "module", "node", "development|production"] },
  });
  expect(p.configEnvironment("web", { consumer: "client" })).toEqual({
    resolve: { conditions: ["keel", "module", "browser", "development|production"] },
    ...CSS,
  });
  // Vite merges the returned list after the environment's own (an `exports` map's key order decides, not this list's).
  expect(p.configEnvironment("client", { resolve: { conditions: ["node"] } })).toEqual({
    resolve: { conditions: ["keel"] },
    ...CSS,
  });
  expect(p.configEnvironment("ssr", { resolve: { conditions: ["keel", "node"] } })).toBeNull();
  expect(p.configEnvironment("client", { resolve: { conditions: ["keel", "browser"] } })).toEqual(CSS);
});

it("a project's own `cssMinify: false` is kept: nothing is minified, so no color is rewritten", () => {
  const p = keel();
  p.config({ root: "/nowhere", build: { cssMinify: false } }, { command: "serve" });
  expect(p.configEnvironment("client", {})).toMatchObject({ build: { cssMinify: false } });
});
