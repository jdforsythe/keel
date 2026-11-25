// @vitest-environment happy-dom
// k.claim, Server "In the runtime's server mode an element made in a level's render and placed by an `element` fill, a slot or a structural op that started after it was made is E1257: `createApp` logs a `diag` record with the code and the route id (k.server Log) the first time a route renders one, in every mode, and serves the document unchanged. Another level's content and parsed HTML are not checked."
// Spec: k.claim, clause "A served page passing an eager element to `Form`, a base element or a component reading its prop first logs one E1257 with its route id over two requests; its thunked twin, nested islands and every packaged component log none."
// k.claim, Rules "E1257 an element placed by an op that started after it was made, in a served render"
// Seed: 1337 (no generated inputs). Each page is served twice per app. The packaged components' own E1257 checks are in the packages that own them.
import { afterEach, describe, expect, it } from "vitest";
import { routes as caseRoutes } from "./claim-cases-routes.ts";
import { CASES } from "./claim-cases.ts";
import { MODULES, routesOf } from "./claim-e1257-routes.ts";
import { e1257Lines } from "./claim-support.ts";
import { serve } from "./resume-app.ts";
import { type Lines, appOf } from "./resume-graph-app.ts";
import { EMPTY, STRUCTURAL, THREE, TWO } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const modes = ["dev", "production"] as const;
const noNonce = (text: string): string => text.replace(/nonce="[^"]*"/g, 'nonce=""');

async function get(app: Awaited<ReturnType<typeof appOf>>, path: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  return { status: res.status, text: noNonce(await res.text()) };
}

describe("k.claim: a served page that places an element made before its op logs E1257", () => {
  for (const mode of modes) {
    for (const [id, path, what] of [
      ["x1.page", "/x1", "an eager element given to Form"],
      ["x2.page", "/x2", "an eager child given to a base element through a member"],
      ["x3.page", "/x3", "a component reading its element-valued prop first"],
    ] as const) {
      it(`${what} logs one E1257 with its route id over two requests in ${mode}, and the document is the thunked twin's`, async () => {
        const log: Lines = { lines: [] };
        const app = await appOf(routesOf("eager"), MODULES, { mode, log });
        const first = await get(app, path);
        const second = await get(app, path);
        expect(first.status).toBe(200);
        expect(second.text).toBe(first.text);
        expect(e1257Lines(log.lines)).toHaveLength(1);
        expect(e1257Lines(log.lines, id)).toHaveLength(1);

        const twinLog: Lines = { lines: [] };
        const twin = await appOf(routesOf("thunk"), MODULES, { mode, log: twinLog });
        const same = await get(twin, path);
        expect(e1257Lines(twinLog.lines)).toEqual([]);
        expect(first.status).toBe(same.status);
        expect(first.text).toBe(same.text);
      });
    }
  }

  it("two faulty routes log one record each", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routesOf("eager"), MODULES, { log });
    for (const path of ["/x1", "/x2", "/x1", "/x2"]) await get(app, path);
    expect(e1257Lines(log.lines, "x1.page")).toHaveLength(1);
    expect(e1257Lines(log.lines, "x2.page")).toHaveLength(1);
    expect(e1257Lines(log.lines)).toHaveLength(2);
  });

  it("the thunked twin of each page logs no E1257, in dev and production", async () => {
    for (const mode of modes) {
      const log: Lines = { lines: [] };
      const app = await appOf(routesOf("thunk"), MODULES, { mode, log });
      for (const path of ["/x1", "/x2", "/x3", "/x1", "/x2", "/x3"]) expect((await get(app, path)).status).toBe(200);
      expect(e1257Lines(log.lines)).toEqual([]);
    }
  });

  for (const mode of modes) {
    it(`an island layout around a static layout around an island page logs no E1257 in ${mode}`, async () => {
      const log: Lines = { lines: [] };
      await serve(THREE, "/three", { mode, log });
      await serve(THREE, "/three", { mode, log });
      await serve(TWO, "/two", { mode, log });
      expect(e1257Lines(log.lines)).toEqual([]);
    });

    it(`If, For with empty, Match with Case and Boundary pages log no E1257 in ${mode}`, async () => {
      const log: Lines = { lines: [] };
      await serve(STRUCTURAL, "/structural", { mode, log });
      await serve(EMPTY, "/empty", { mode, log });
      expect(e1257Lines(log.lines)).toEqual([]);
    });

    it(`nested components, Form with JSX children, Part, fragments, For rows and a component with array children log no E1257 in ${mode}`, async () => {
      const log: Lines = { lines: [] };
      const modules = [...new Set([...CASES.map((c) => c.key), "ef", "eg", "eh", "er", "ek"])];
      const app = await appOf(caseRoutes, modules, { mode, log });
      for (const c of CASES) {
        expect((await get(app, `/${c.key}`)).status).toBe(200);
        expect((await get(app, `/${c.key}`)).status).toBe(200);
      }
      expect(e1257Lines(log.lines)).toEqual([]);
    });
  }
});
