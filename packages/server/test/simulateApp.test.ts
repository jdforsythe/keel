// k.drive-law: a `simulate` scenario over `createApp` with a POST replays to the same trace, the caller the action
// stores included (the caller cookie's key and token come from `ctx.random`). The last test is the keel-testing skill's
// worked example, verbatim. Seed 1337.
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { simulate } from "@keel/testing";
import { expect, test } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Note = s.object({ text: s.string({ min: 1 }) });
const c = contract("sa", { "sa.page": { path: "/sa" }, "sa.done": { path: "/sa-done" } });
const factory = () => {
  const notes = store(s.object({ items: s.array(s.string()) }), { items: [] }, { id: "sa.notes" });
  const add = transaction(notes, "sa.add", Note, (st, { text }) => ({ items: [...st.items, text] }));
  return { notes, add };
};
const routes = manifest(c, {
  "sa.page": {
    component: () => document.createElement("main"),
    loader: loader(c, "sa.page", { output: s.object({}), stores: factory }, async () => ok({})),
    POST: action(c, "sa.page", { input: Note, stores: factory }, async (input, { stores, caller }) => {
      tx(stores.add, { text: `${input.text}:${caller}` });
      return ok(c.href("sa.done"));
    }),
  },
  "sa.done": { component: () => document.createElement("main") },
});

test("a POST to createApp under simulate replays to the same trace", async () => {
  await simulate(
    async ({ ctx, run }) => {
      const app = await createApp({ topology: topology({ web: { modules: ["sa"], adapter: "node" } }), routes, ctx });
      const res = await app.fetch(
        new Request("http://localhost/sa", {
          method: "POST",
          body: new URLSearchParams({ text: "milk" }),
          headers: { origin: "http://localhost", "sec-fetch-site": "same-origin" },
        }),
      );
      expect([303, 500]).toContain(res.status);
      const doc = await app.fetch(new Request("http://localhost/sa", { headers: { accept: "text/html" } }));
      expect([200, 500]).toContain(doc.status);
      await doc.text();
      const json = await app.fetch(
        new Request("http://localhost/sa", {
          method: "POST",
          body: JSON.stringify({ text: "x" }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            origin: "http://localhost",
            "x-keel": "1",
          },
        }),
      );
      expect([200, 500]).toContain(json.status);
      await run();
      await app.close();
    },
    { runs: 40, seed: 1337, law: true },
  );
});

const notes = contract("notes", { "notes.page": { path: "/notes" } });
const post = action(notes, "notes.page", { input: s.object({}) }, async () => ok(null));
const notesRoutes = manifest(notes, { "notes.page": { component: () => document.createElement("main"), POST: post } });

test("the skill's example: a POST to the app replays to the same trace", async () => {
  await simulate(
    async ({ ctx, run }) => {
      const app = await createApp({
        topology: topology({ web: { modules: ["notes"], adapter: "node" } }),
        routes: notesRoutes,
        ctx,
      });
      const headers = { origin: "http://localhost", "sec-fetch-site": "same-origin" };
      await app.fetch(new Request("http://localhost/notes", { method: "POST", body: new URLSearchParams(), headers }));
      await run();
      await app.close();
    },
    { runs: 100, seed: 7, law: true },
  );
});
