// The routes of the fresh-graph suite (not a test file). The test imports this file for the server side; `resumeDocument`
// imports it again for the client side, where every module it reaches, `@keel/store` included, is evaluated anew.
import { loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { ok, s } from "@keel/schema";
import { store, stores, transaction, tx } from "@keel/store";
import { compileComponent, islandPage } from "./resume-app.ts";
import { board } from "./resume-modstore.ts";

const Local = s.object({ n: s.int() });
const Data = s.object({ title: s.string() });

const localPage = compileComponent("gl.page", islandPage("gl"));
const createdPage = compileComponent("gc.page", islandPage("gc"));
const readPage = compileComponent("gr.page", islandPage("gr"));

const countOf = (snapshot: { readonly state: unknown }): string => String(Reflect.get(Object(snapshot.state), "n"));

/** The loader creates the request store `p.local` and writes `{ n: 3 }` to it. */
const seedLocal = loader({ output: Data }, () => {
  const local = store(Local, { n: 0 }, { id: "p.local" });
  const set = transaction(local, "p.local.set", Local, (_state, payload) => payload);
  void tx(set, { n: 3 });
  return Promise.resolve(ok({ title: "seeded" }));
});

/** Uses the store the request holds; with none (a resumed island) it creates the store its snapshot waits for. */
function LocalPage(props: RouteProps): Node {
  const found = stores().get("p.local");
  const local = found ?? store(Local, { n: 0 }, { id: "p.local" });
  return localPage(Object.assign({}, props, { data: { title: countOf(local.snapshot()) } }));
}

/** Creates the store `p.created` while rendering and leaves it at its initial state. */
function CreatedPage(props: RouteProps): Node {
  const created = store(Local, { n: 7 }, { id: "p.created" });
  return createdPage(Object.assign({}, props, { data: { title: countOf(created.snapshot()) } }));
}

/** Reads the module store `rm.board` and never writes it. */
function ReadPage(props: RouteProps): Node {
  return readPage(Object.assign({}, props, { data: { title: board.get("rows") } }));
}

export const routes = manifest({
  "gl.page": { path: "/local", component: LocalPage, loader: seedLocal },
  "gc.page": { path: "/created", component: CreatedPage },
  "gr.page": { path: "/read", component: ReadPage },
});

export default routes;
