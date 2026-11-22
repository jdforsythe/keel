// @vitest-environment happy-dom
// k.server Server state with k.routes Layouts: a layout's loader and its page's loader whose two `stores` factories
// create one store id answer 500 at run time, the second factory to open throwing (k.store Registries: one live store
// per id in the request scope). Both naming one factory open it once and share it. Seed 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Name = s.object({ name: s.string() });
const Runs = s.object({ runs: s.int() });
const homeStores = () => ({ home: store(Name, { name: "Home" }, { id: "app.home" }) });
const pageStores = () => ({ ...homeStores(), runs: store(Runs, { runs: 0 }, { id: "app.runs" }) });

async function build(page: typeof homeStores | typeof pageStores, lines: string[]) {
  const c = contract("app", { "app.frame": { layout: true }, "app.setup": { path: "/setup" } });
  const frame = loader(c, "app.frame", { output: Name, stores: homeStores }, async ({ stores }) =>
    ok({ name: stores.home.get("name") }),
  );
  const setup = loader(c, "app.setup", { output: Name, stores: page }, async ({ stores }) =>
    ok({ name: stores.home.get("name") }),
  );
  const routes = manifest(c, {
    "app.frame": { loader: frame, component: ({ children }) => children?.() ?? document.createElement("div") },
    "app.setup": { layout: "app.frame", loader: setup, component: () => document.createElement("main") },
  });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "compact", write: (l) => lines.push(l) },
  });
}

describe("a layout and its page over one store id", () => {
  it("two factories creating one id: the page's loader throws and the request answers 500", async () => {
    const lines: string[] = [];
    const app = await build(pageStores, lines);
    const res = await app.fetch(new Request("http://localhost/setup"));
    expect(res.status).toBe(500);
    expect(lines.filter((l) => l.startsWith("keel.unexpected "))).toEqual([
      "keel.unexpected loader app.setup threw: Error: store app.home: id already in use by a live store",
    ]);
  });

  it("both loaders naming one factory share its instance and answer 200", async () => {
    const lines: string[] = [];
    const app = await build(homeStores, lines);
    const res = await app.fetch(new Request("http://localhost/setup"));
    expect(res.status).toBe(200);
    expect(lines.filter((l) => l.startsWith("keel.unexpected "))).toEqual([]);
  });
});
