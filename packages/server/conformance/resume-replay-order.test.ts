// @vitest-environment happy-dom
// Spec: k.resume, Conformance "Clicks queued on a page island's button, then its layout island's, replay after both resume, page first; a layout handler on an element enclosing the page's button runs after the page's, unless the page's calls `stopPropagation`."
// Spec: k.resume, Replay "Events queued before resume replay once all islands resume, in fired order, each as a live one: from the target through each enclosing island, until `stopPropagation`; one in a re-rendered island's own nodes is dropped."
// Spec: k.runtime, Resume "per island it then fires `input` on each control off its default value with none queued, then replays queued events in order, reporting each before its handlers."
// Seed: 1337 (no generated inputs). Real compiled TSX, real createApp, real resume on a sim ctx with an observer.
import { afterEach, describe, expect, it } from "vitest";
import { type Component, type Level, componentsOf, install, q, serve } from "./resume-app.ts";
import {
  clickNow,
  firedOf,
  recording,
  replayLayout,
  replayPage,
  resumeObserved,
  typeNow,
} from "./resume-replay-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const levels = (layout: string, page: string): readonly Level[] => [
  { id: "rp.layout", source: layout },
  { id: "rpp.page", source: page, path: "/replay", layout: "rp.layout" },
];

const PLAIN = levels(replayLayout("l"), replayPage("p"));

function client(
  of: readonly Level[],
  log: string[],
  override: Readonly<Record<string, string>> = {},
): Record<string, Component> {
  const out: Record<string, Component> = {};
  for (const [id, c] of Object.entries(componentsOf(of, override))) out[id] = recording(c, log);
  return out;
}

const clicks = (log: readonly string[]): string[] => log.filter((id) => id.endsWith(".btn"));

describe("k.resume: queued events replay once every island has resumed, in fired order, each as a live event", () => {
  it("clicks queued on a page island's button, then its layout island's, replay after both resume, page first", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("p.btn");
    clickNow("l.btn");
    const log: string[] = [];
    const { warnings } = resumeObserved(client(PLAIN, log));
    expect(warnings).toEqual([]);
    expect(clicks(log)).toEqual(["p.btn", "l.btn"]);
    expect(log.filter((id) => id === "p.btn")).toHaveLength(1);
    expect(log.filter((id) => id === "l.btn")).toHaveLength(1);
  });

  it("replay happens after both islands have built: the layout's and the page's bodies run before the first replayed handler", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("l.btn");
    clickNow("p.btn");
    const log: string[] = [];
    resumeObserved(client(PLAIN, log));
    const first = log.findIndex((id) => id.endsWith(".btn"));
    expect(log.slice(0, first).sort()).toEqual(["l.built", "p.built"]);
  });

  it("events replay in the order they fired, not nested-first", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("l.btn");
    clickNow("p.btn");
    clickNow("l.btn");
    const log: string[] = [];
    resumeObserved(client(PLAIN, log));
    expect(clicks(log)).toEqual(["l.btn", "p.btn", "l.btn"]);
  });

  it("an observer on the ctx gets the served nav, then the queued events in fired order", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("p.btn");
    clickNow("l.btn");
    const { events } = resumeObserved(client(PLAIN, []));
    expect(events[0]?.kind).toBe("nav");
    expect(firedOf(events)).toEqual(["click:p.btn", "click:l.btn"]);
  });

  it("a layout handler on an element enclosing the page's button runs after the page's for one queued page click", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("p.btn");
    const log: string[] = [];
    resumeObserved(client(PLAIN, log));
    expect(log.filter((id) => !id.endsWith(".built"))).toEqual(["p.btn", "l.wrap"]);
  });

  it("with the page's handler calling stopPropagation the enclosing layout handler records nothing", async () => {
    const stopped = levels(replayLayout("l"), replayPage("p", { stop: true }));
    install(await serve(stopped, "/replay"));
    clickNow("p.btn");
    const log: string[] = [];
    resumeObserved(client(stopped, log));
    expect(log.filter((id) => !id.endsWith(".built"))).toEqual(["p.btn"]);
  });

  it("a queued click on an element of the layout outside the page reaches the layout's handlers only", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("l.btn");
    const log: string[] = [];
    resumeObserved(client(PLAIN, log));
    expect(log.filter((id) => !id.endsWith(".built"))).toEqual(["l.btn"]);
  });

  it("each replayed handler updates its bindings once", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("p.btn");
    clickNow("p.btn");
    clickNow("l.btn");
    resumeObserved(client(PLAIN, []));
    expect(q("p.out").textContent).toBe("2");
    expect(q("l.out").textContent).toBe("1");
  });
});

describe("k.resume: the input a control typed before load fires per island, ahead of every replayed event", () => {
  const typed = levels(replayLayout("l", { input: true }), replayPage("p", { input: true }));

  it("every input comes before the first replayed click, layout's before page's", async () => {
    install(await serve(typed, "/replay"));
    typeNow("l.name", "x");
    typeNow("p.name", "y");
    clickNow("p.btn");
    clickNow("l.btn");
    const { events } = resumeObserved(client(typed, []));
    expect(firedOf(events)).toEqual(["input:l.name", "input:p.name", "click:p.btn", "click:l.btn"]);
  });

  it("a control typed in the page only gives one input, before the queued clicks", async () => {
    install(await serve(typed, "/replay"));
    clickNow("l.btn");
    typeNow("p.name", "y");
    const { events } = resumeObserved(client(typed, []));
    expect(firedOf(events)).toEqual(["input:p.name", "click:l.btn"]);
  });
});

describe("k.resume: an event in a re-rendered island's own nodes is dropped; other islands' events still replay", () => {
  const EXTRA = "<em>extra</em>";

  it("a click queued on a layout island that mismatched is dropped while the page's replays and reaches the re-rendered layout's enclosing handler", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("l.btn");
    clickNow("p.btn");
    const log: string[] = [];
    const { warnings } = resumeObserved(client(PLAIN, log, { "rp.layout": replayLayout("l", { pre: EXTRA }) }));
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0])).toMatch(/^E1253 \[data-k-island="rp\.layout"\]/);
    expect(log.filter((id) => !id.endsWith(".built"))).toEqual(["p.btn", "l.wrap"]);
    expect(q("l.out").textContent).toBe("0");
    expect(q("p.out").textContent).toBe("1");
  });

  it("a click queued on a page island that mismatched is dropped while the layout's replays", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("p.btn");
    clickNow("l.btn");
    const log: string[] = [];
    const { warnings } = resumeObserved(client(PLAIN, log, { "rpp.page": replayPage("p", { pre: EXTRA }) }));
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0])).toMatch(/^E1253 \[data-k-island="rpp\.page"\]/);
    expect(log.filter((id) => !id.endsWith(".built"))).toEqual(["l.btn"]);
    expect(q("p.out").textContent).toBe("0");
    expect(q("l.out").textContent).toBe("1");
  });

  it("both mismatching drops every queued event", async () => {
    install(await serve(PLAIN, "/replay"));
    clickNow("p.btn");
    clickNow("l.btn");
    const log: string[] = [];
    resumeObserved(
      client(PLAIN, log, {
        "rp.layout": replayLayout("l", { pre: EXTRA }),
        "rpp.page": replayPage("p", { pre: EXTRA }),
      }),
    );
    expect(log.filter((id) => !id.endsWith(".built"))).toEqual([]);
  });
});
