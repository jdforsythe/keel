// k.topology Calls and peers: `service({ contract })` reaches a module in another `node` deployable at its peer URL.
// k.user Across deployables: the call's `user` is sent as `x-keel-user`, signed with the shared secret; the receiver
// uses it as `user` and runs no `identify`; any other `x-keel-user` is ignored. Here `web` names `api` by URL, and
// the sim net of `web` plays the network between the two servers. k.services Encoding: a request to a peer also
// carries `x-keel: 1`.
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import source from "../identity.server.ts";
import { routes as front } from "../modules/front/routes.ts";
import { routes as greet } from "../modules/greet/routes.ts";
import topology from "../topology.ts";

const secret = "compose-peers-test-secret-of-32-bytes";
const API = "http://api.test";

/** Both deployables over their own sim ctx; `ctx` is web's; `seen` lists each request `api` received with whether it carried the user header and its `x-keel` value. */
async function peers() {
  const api = await createApp({
    topology,
    routes: greet,
    ctx: createCtx({ mode: "sim", seed: 1 }),
    deployable: "api",
    identity: source,
    secret,
  });
  const ctx = createCtx({ mode: "sim", seed: 2 });
  const seen: string[] = [];
  ctx.net.route(`${API}/*`, (req) => {
    seen.push(
      `${req.method} ${new URL(req.url).pathname} ${req.headers.has("x-keel-user")} ${req.headers.get("x-keel")}`,
    );
    return api.fetch(req);
  });
  const web = await createApp({
    topology,
    routes: front,
    ctx,
    deployable: "web",
    identity: source,
    secret,
    peers: { api: new URL(API) },
  });
  return { api, web, seen, ctx };
}

const page = (user?: string) =>
  new Request("http://web.test/", { headers: { accept: "text/html", ...(user ? { "x-forwarded-user": user } : {}) } });

it("greets the user web signed in, through the api peer, with the user carried in a signed header and `x-keel: 1`", async () => {
  const { web, seen } = await peers();
  const res = await web.fetch(page("Ada"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Hello, Ada");
  expect(seen).toEqual(["GET /api/hello true 1"]);
});

it("shows the peer's refusal when no one is signed in", async () => {
  const { web } = await peers();
  expect(await (await web.fetch(page())).text()).toContain("api.status");
});

it("ignores a user header the api did not sign", async () => {
  const { api } = await peers();
  const res = await api.fetch(
    new Request(`${API}/api/hello`, { headers: { accept: "application/json", "x-keel-user": "Ada" } }),
  );
  expect(res.status).toBe(403);
});

it("renders the front page as a browser gets it: one main landmark, a named heading, the greeting as text", async () => {
  const { web, ctx } = await peers();
  const page = await renderRoute("front.home", { routes: front, params: {}, ctx, app: web });
  try {
    expect(page.find("front.home").role).toBe("main");
    expect(page.a11y("front.home.title")).toMatchObject({ role: "heading", name: "Two peers" });
    expect(page.find("front.home.greeting").text).toContain("api.status");
    expect(page.focusOrder()).toEqual([]);
  } finally {
    page.dispose();
  }
});
