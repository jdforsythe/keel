// @vitest-environment happy-dom
// Spec: k.place, clause "`function Card(props: { icon: () => Node })` rendering `<Box>{props.icon()}</Box>` with `icon: () => <Text>i</Text>`: served by `createApp`, the document holds the `Text` element in the `Box`; resumed by `resumeDocument`, no warning, `removed()` and `detached()` 0, and a handler on the icon's element runs. The same with `props.icon?.()`, `props.icon?.() ?? 'none'` with `icon` absent (`none` as text), two elements beside text, and inside `If` and `For` content."
// Spec: k.place, clause "`{props.label()}` with `label: () => 'Hi'` renders `Hi` once in its place; `{String(props.count())}` updates when the signal it reads changes."
// Seed: 1337 (no generated inputs). The served pages are real createApp output (./place-routes.ts); the client side is
// `resumeDocument` in a module graph of its own. Assumption: `removed()` and `detached()` return counts.
// Not covered by the click step: the `For` case, whose rows hold an icon with no id to fire.
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { e1257Lines } from "./claim-support.ts";
import { CASES } from "./place-cases.ts";
import { routes } from "./place-routes.ts";
import { appOf } from "./resume-graph-app.ts";

// One contract, so one module: every case page belongs to `pl`.
const MODULES = ["pl"];
const FRESH = () => import("./place-routes.ts");

async function served(path: string): Promise<{ html: string; lines: string[] }> {
  const lines: string[] = [];
  const app = await appOf(routes, MODULES, { log: { lines } });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return { html: await res.text(), lines };
}

const cardOf = (html: string, key: string): Element => {
  const card = new DOMParser().parseFromString(html, "text/html").querySelector(`[id="${key}.card"]`);
  if (card === null) throw new Error(`fixture: no ${key}.card in the served document`);
  return card;
};

describe("k.place: a prop call alone in a JSX child is placed as content", () => {
  for (const c of CASES) {
    it(`${c.title}: the served document holds the content inside the card`, async () => {
      const { html } = await served(`/${c.key}`);
      const card = cardOf(html, c.key);
      for (const selector of c.inside) expect(card.querySelector(selector), selector).not.toBeNull();
      if (c.cardText !== undefined) expect(card.textContent ?? "").toMatch(c.cardText);
    });

    it(`${c.title}: resumed by resumeDocument there is no warning, removed() and detached() are 0, and the handlers run`, async () => {
      const { html, lines } = await served(`/${c.key}`);
      expect(e1257Lines(lines)).toEqual([]);
      const t = await resumeDocument(html, { routes: FRESH });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      for (const id of c.hits) await t.fire(id, { type: "click" });
      expect(t.find(`${c.key}.out`).text).toBe(String(c.hits.length));
      t.dispose();
    });
  }

  it("the elements a card places are those the icon made: one `hit` button per page, not two", async () => {
    for (const c of CASES.filter((x) => x.hits.length > 0)) {
      const { html } = await served(`/${c.key}`);
      for (const id of c.hits) {
        expect(new DOMParser().parseFromString(html, "text/html").querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
      }
    }
  });

  it("after a click on the placed icon the elements are the ones the server served, in the same order", async () => {
    const { html } = await served("/p4");
    const t = await resumeDocument(html, { routes: FRESH });
    await t.fire("p4.hit", { type: "click" });
    expect(t.find("p4.out").text).toBe("1");
    expect(t.find("p4.card").text).toMatch(/lead\s*1\s*a\s*hit\s*tail/);
    t.dispose();
  });

  it("`{props.label()}` renders `Hi` once in its place and resume keeps it", async () => {
    const { html } = await served("/p8");
    expect(cardOf(html, "p8").textContent ?? "").toMatch(/^\s*Hi\s*$/);
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.find("p8.card").text).toMatch(/^\s*Hi\s*$/);
    expect(t.removed()).toBe(0);
    t.dispose();
  });
});
