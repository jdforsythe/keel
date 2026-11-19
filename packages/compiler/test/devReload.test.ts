// `keel dev` (k.topology Local topology): a changed app source closes the dev apps and the next request loads them
// again. The next apps load only once the old ones have closed, so two generations never share storage (a leased
// job runs once).
import fs from "node:fs";
import http from "node:http";
import { Socket } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, expect, it } from "vitest";

let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-devreload-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const ticks = async (): Promise<void> => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

it("loads the next dev apps only after the old ones have closed", async () => {
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  const events: string[] = [];
  let release = (): void => {};
  let loads = 0;
  const app = (n: number) => ({
    fetch: () => Promise.resolve(new Response(null)),
    close: () => {
      events.push(`close ${n}`);
      return new Promise<void>((resolve) => {
        release = () => {
          events.push(`closed ${n}`);
          resolve();
        };
      });
    },
  });
  const p = keel();
  p.configResolved({ root });
  const used: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0][] = [];
  p.configureServer({
    moduleGraph: { getModuleById: () => undefined },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: () => {
      loads++;
      events.push(`load ${loads}`);
      return Promise.resolve({ apps: [["api", app(loads), () => false]] });
    },
    middlewares: {
      use(fn) {
        used.push(fn);
      },
    },
  });
  const handle = used[1];
  if (handle === undefined) throw new Error("no dev middleware");
  const request = (): Promise<void> =>
    new Promise((resolve) => {
      const req = new http.IncomingMessage(new Socket());
      req.url = "/elsewhere";
      req.method = "GET";
      req.headers = { host: "localhost" };
      handle(req, new http.ServerResponse(req), () => resolve());
    });
  await request();
  p.watchChange(path.join(root, "modules/a/page.ts"), { event: "update" });
  const second = request();
  await ticks();
  expect(loads).toBe(1);
  release();
  await second;
  expect(events).toEqual(["load 1", "close 1", "closed 1", "load 2"]);
});
