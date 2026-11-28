// Spec: k.entries, clause "In k.library's `site` project, with `exports` gaining `\"./routes\":{\"keel\":\"./src/routes.ts\",\"default\":\"./routes.js\"}` and `modules` `['shop', 'charts']`, the entry `keel dev` serves imports `charts`' routes from `node_modules/@acme/charts/src/routes.ts`, never `routes.js`."
// k.library, Kind: "An `exports` entry lists a `keel` condition first, its `.ts` or `.tsx` source, before the built `types` and `default` (k.library-pack); one without it is read at its other target."
// Seed: 1337 (no generated input: one fixture, one `keel dev` on a free port from a closed port-0 listener, never 8080, 5173, 5214 or 5432; the child's group ended in `finally`).
// ASSUMPTIONS (spec silent): the library's contract is `shared.ts` beside `package.json` (`contract()` is E1513 in `src/`), which `src/routes.ts` imports; the project is k.library's `site` project (a `static` deployable, here with `modules` `['shop', 'charts']`) and the library keeps `src/index.ts`, so `Badge` is still exported;
// "imports `charts`' routes from `src/routes.ts`" is observed two ways: `src/routes.ts` holds the route `charts.about` whose component renders `ROUTES-FROM-SOURCE`, and `routes.js` writes a marker file when imported, so a read of `routes.js`
// leaves the marker; "serves" is a GET of `/about` with `accept: text/html` after `keel dev` printed its ready line. The marker lives in a temp folder the test removes.
import { existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, expect, test } from "vitest";
import { cleanup, library, materialize, project } from "./library-support.ts";
import { SLOW, freePort, get, served, startDev, stop, stopAll } from "./static-support.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
afterEach(async () => {
  await stopAll();
});

const CONTRACT = `import { contract } from "@keel/router/contract";
export const charts = contract("charts", { "charts.about": { path: "/about" } });
`;
const SOURCE_ROUTES = `import { manifest } from "@keel/router";
import About from "./About.tsx";
import { charts } from "../shared.ts";
export const routes = manifest(charts, { "charts.about": { component: () => About({ id: "charts.about" }) } });
`;
const ABOUT = [
  "import { Text } from '@keel/ui'",
  "export default function About(props: { id: string }) {",
  "  return <Text id={`${props.id}.text`}>ROUTES-FROM-SOURCE</Text>",
  "}",
  "",
].join("\n");
const builtRoutes = (marker: string): string =>
  `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "imported");\nexport const routes = undefined;\n`;

test(
  'In k.library\'s `site` project, with `exports` gaining `"./routes":{"keel":"./src/routes.ts","default":"./routes.js"}` and `modules` `[\'shop\', \'charts\']`, the entry `keel dev` serves imports `charts`\' routes from `node_modules/@acme/charts/src/routes.ts`, never `routes.js`',
  async () => {
    const side = mkdtempSync(join(realpathSync(tmpdir()), "keel-routes-dev-"));
    made.push(side);
    const marker = join(side, "built-routes-imported.txt");
    const dir = realpathSync(
      materialize(
        project({
          adapter: "static",
          home: true,
          page: false,
          modules: ["shop", "charts"],
          libraries: [
            library({
              exports: { "./routes": { keel: "./src/routes.ts", default: "./routes.js" } },
              files: {
                "shared.ts": CONTRACT,
                "src/routes.ts": SOURCE_ROUTES,
                "src/About.tsx": ABOUT,
                "routes.js": builtRoutes(marker),
              },
            }),
          ],
        }),
      ),
    );
    made.push(dir);
    const port = await freePort();
    const p = startDev(dir, port);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const res = await get(port, "/about");
      expect(res?.status, p.out().slice(-600)).toBe(200);
      expect(res?.body, "the route the source holds is served").toContain("ROUTES-FROM-SOURCE");
      expect(existsSync(marker), "routes.js was never imported").toBe(false);
    } finally {
      await stop(p);
    }
  },
  SLOW,
);
