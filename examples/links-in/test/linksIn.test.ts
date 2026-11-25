// k.links: a return link `<id>:/<path>` whose path is a page the router matches is a client-side navigation there, at
// launch or while running, as a web link to that page; a link of another scheme or to no page is ignored. The shell's
// id in `topology.ts` is the scheme.
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/places/routes.ts";
import { artifacts } from "./artifacts.ts";

/** The Tauri shell's id in `topology.ts`, and so its scheme. */
const id = "dev.keel.linksin";

it("opens the place a link names while the shell runs", async () => {
  const t = await renderRoute("places.home", { routes, shell: { id }, artifacts });
  try {
    expect(t.find("places.home").role).toBe("main");
    expect(t.focusOrder()).toEqual(["places.home.toLisbon"]);
    await t.returnLink(`${id}:/places/oslo`);
    expect(t.route()).toMatchObject({ id: "places.place", params: { placeId: "oslo" } });
    expect(t.find("places.place.title").text).toBe("oslo");
    // The place page names itself in its heading and offers one link back, the only stop for the keyboard.
    expect(t.a11y("places.place.title")).toMatchObject({ role: "heading", name: "oslo" });
    expect(t.focusOrder()).toEqual(["places.place.toHome"]);
    expect(t.find("places.place.toHome").name).toBe("All places");
  } finally {
    t.dispose();
  }
});

it("opens the place the shell was launched with", async () => {
  const t = await renderRoute("places.home", { routes, shell: { id }, launch: "later" });
  try {
    expect(t.route()).toMatchObject({ id: "places.home" });
    await t.launch([`${id}:/places/lisbon?from=mail`]);
    expect(t.route()).toMatchObject({ id: "places.place", params: { placeId: "lisbon" } });
  } finally {
    t.dispose();
  }
});

it("ignores a link of another scheme and a link to no page", async () => {
  const t = await renderRoute("places.home", { routes, shell: { id } });
  try {
    await t.returnLink("dev.keel.other:/places/oslo");
    await t.returnLink(`${id}:/nowhere`);
    expect(t.route()).toMatchObject({ id: "places.home" });
    expect(t.documents()).toEqual([]);
  } finally {
    t.dispose();
  }
});
