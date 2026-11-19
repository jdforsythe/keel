// @vitest-environment happy-dom
// Spec: k.opening, clause "The link's GET answered 303 to `/`, then a `fire` `input` on a field and the handle's `navigate('/auto')`, records `https://provider.example/a` in `documents()`; a second delivery of the link then sends nothing. With a `fire` `keydown` `Escape` on the field instead it sends nothing; with `keydown` `a`, one GET."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts (field `ac.home.field`; the 303 to `/` lands on the home page).
// ASSUMED: `fire(id, { type: "keydown", key })` carries the key; `handle.navigate(path)` returns a promise or nothing.
// Reading: the provider URL is in documents() twice, once for the opening the case starts with and once for the `navigate('/auto')`.
import type { TestEvent } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { AUTO_HREF, routes } from "./act-pages.ts";
import { CALLBACK, CB_PATH, base, count, opening, providerDocs } from "./link-helpers.ts";
import { closeAll, openShellOver, ticks } from "./return-support.ts";

afterEach(closeAll);

async function afterLink(event: TestEvent): Promise<{ docs: number; second: number }> {
  const { handle, sent } = await openShellOver(routes, "ac.home", base);
  await opening(handle);
  await handle.returnLink(CALLBACK);
  await ticks();
  expect(count(sent, CB_PATH)).toBe(1);
  await handle.fire("ac.home.field", event);
  await ticks();
  await handle.navigate(AUTO_HREF);
  await ticks();
  const docs = providerDocs(handle);
  await handle.returnLink(CALLBACK);
  await ticks();
  const second = count(sent, CB_PATH) - 1;
  handle.dispose();
  return { docs, second };
}

describe("k.opening: a person's act ends the link-started state", () => {
  it("the link's GET answered 303 to /, then a fire input on a field and navigate('/auto'), records the provider URL in documents(); a second delivery of the link then sends nothing", async () => {
    expect(await afterLink({ type: "input", value: "x" })).toEqual({ docs: 2, second: 0 });
  });

  it("with a fire keydown Escape on the field instead it sends nothing", async () => {
    expect(await afterLink({ type: "keydown", key: "Escape" })).toEqual({ docs: 2, second: 0 });
  });

  it("with keydown a, one GET", async () => {
    expect(await afterLink({ type: "keydown", key: "a" })).toEqual({ docs: 2, second: 1 });
  });
});
