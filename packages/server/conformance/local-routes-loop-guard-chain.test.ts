// @vitest-environment happy-dom
// Spec: k.topology, clause "`y` answers a `GET /c` with `x-keel-forwarded: 1`, `/c` a page of its peer `z` alone, 404, as does `x` forwarding `/c` to `y`; `z` gets no request."
// Seed 1337 (fast-check: the query and the header's value). Fixture (the RFC 0244 sketch): three `createApp`s in process. `y` serves module `b` and has peer `z` at the sim net URL
// `http://z.test`, whose `routes.json` gives `/c` to `z`'s module `c`; `x` serves module `a`, has `y` as an in-process peer, and its `routes.json` gives `/c` to `y`'s module `b`.
// `z`'s net route counts the requests it gets. A control request to `y` with no marker is forwarded to `z`, so the count is read from a fixture that does reach `z`.
// ASSUMED: (1) "as does `x` forwarding `/c` to `y`" means a client's `GET /c` to `x`, unmarked, is forwarded to `y` and answered 404 there, `x` returning that response; (2) `y` serves no route at `/c` itself.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, pageManifest, simCtx, writeArtifacts, type Fetcher } from "./topology-fixtures.ts";

const build = async (): Promise<{ x: Fetcher; y: Fetcher; zRequests: Request[] }> => {
  const t = topology({
    x: { modules: ["a"], adapter: "node" },
    y: { modules: ["b"], adapter: "node" },
    z: { modules: ["c"], adapter: "node" },
  });
  const zRequests: Request[] = [];
  const yCtx = simCtx();
  yCtx.net.route("http://z.test/*", (req) => {
    zRequests.push(req.clone());
    return new Response("z", { status: 200 });
  });
  const y = await createAppLoose({
    topology: t,
    deployable: "y",
    routes: pageManifest("b", "/b", "B"),
    ctx: yCtx,
    peers: { z: "http://z.test" },
    artifacts: writeArtifacts(pageManifest("c", "/c", "C")),
  });
  const x = await createAppLoose({
    topology: t,
    deployable: "x",
    routes: pageManifest("a", "/a", "A"),
    ctx: simCtx(),
    peers: { y },
    artifacts: writeArtifacts(pageManifest("b", "/c", "B")),
  });
  return { x, y, zRequests };
};
const get = (path: string, headers: Record<string, string> = {}): Request =>
  new Request(`http://localhost${path}`, { headers: { accept: "application/json", ...headers } });
const query = fc.stringMatching(/^[a-z0-9]{0,6}$/).map((q) => (q === "" ? "" : `?q=${q}`));

describe("k.topology Calls and peers: a marked request is answered where it arrived", () => {
  it("`y` answers a `GET /c` with `x-keel-forwarded: 1`, `/c` a page of its peer `z` alone, 404", async () => {
    await fc.assert(
      fc.asyncProperty(query, fc.constantFrom("1", "0", "true"), async (q, value) => {
        const { y } = await build();
        const res = await y.fetch(get(`/c${q}`, { "x-keel-forwarded": value }));
        expect(res.status).toBe(404);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`x` forwarding `/c` to `y` answers 404 as well", async () => {
    await fc.assert(
      fc.asyncProperty(query, async (q) => {
        const { x } = await build();
        const res = await x.fetch(get(`/c${q}`));
        expect(res.status).toBe(404);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`z` gets no request, from `y` answering the marked `GET /c` or from `x` forwarding it", async () => {
    await fc.assert(
      fc.asyncProperty(query, async (q) => {
        const { x, y, zRequests } = await build();
        await y.fetch(get(`/c${q}`, { "x-keel-forwarded": "1" }));
        await x.fetch(get(`/c${q}`));
        expect(zRequests).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("the fixture reaches `z`: an unmarked `GET /c` to `y` is forwarded to it", async () => {
    const { y, zRequests } = await build();
    await y.fetch(get("/c"));
    expect(zRequests).toHaveLength(1);
  });
});
