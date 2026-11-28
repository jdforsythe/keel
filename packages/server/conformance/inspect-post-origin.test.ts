// Spec: k.inspect, clause "A `POST /__keel/inspect` without `Origin` on a dev `createApp` gets 403 `keel.denied`."
// @vitest-environment happy-dom
// Lives in the server package because createApp is there. No generated inputs.
import { expect, test } from "vitest";
import { BASE, build } from "./fixtures.ts";

test("A `POST /__keel/inspect` without `Origin` on a dev `createApp` gets 403 `keel.denied`", async () => {
  const { app } = await build({}, "dev");
  const res = await app.fetch(new Request(`${BASE}/__keel/inspect`, { method: "POST", body: "{}" }));
  expect(res.status).toBe(403);
  expect(JSON.stringify(await res.json())).toContain("keel.denied");
});

test("A `GET /__keel/inspect` without `Origin` on a dev `createApp` is not 403", async () => {
  const { app } = await build({}, "dev");
  const res = await app.fetch(new Request(`${BASE}/__keel/inspect`));
  expect(res.status).not.toBe(403);
});
